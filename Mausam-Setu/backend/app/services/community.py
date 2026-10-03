"""Coarse public observations, separate from official warnings and safety scoring.

Free text/photos stay private pending human privacy review. Confidence is a
checklist score, not a probability or automatic verification.
"""

import base64
import hashlib
import io
import secrets
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import AwareDatetime, BaseModel, Field
from sqlalchemy import JSON, DateTime, String, delete, select
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import settings
from app.database.store import Base, Session
from app.providers.extras import distance
from app.schemas.weather import Location, now
from app.services.weather import service
from app.utils.calculations import value

CATEGORIES = [
    "heavy_rain",
    "waterlogging",
    "flooding",
    "dense_fog",
    "hail",
    "strong_wind",
    "thunderstorm",
    "fallen_tree",
    "extreme_heat",
    "road_blockage",
    "coastal_flooding",
]
router = APIRouter(prefix="/api/community")


class Observation(Base):
    __tablename__ = "community_observations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
    private: Mapped[dict] = mapped_column(JSON)
    owner_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[object] = mapped_column(DateTime(timezone=True), index=True)


class Report(BaseModel):
    category: str
    description: str = Field(default="", max_length=500)
    location: Location
    timestamp: AwareDatetime
    photo: str = Field(default="", max_length=2_800_000)


def clean_photo(encoded):
    if not encoded:
        return None
    from PIL import Image, ImageOps

    try:
        raw = base64.b64decode(encoded.split(",")[-1], validate=True)
        if len(raw) > 2_000_000:
            raise ValueError()
        with Image.open(io.BytesIO(raw)) as image:
            if (
                image.format not in ("JPEG", "PNG", "WEBP")
                or image.width * image.height > 12_000_000
            ):
                raise ValueError()
            image = ImageOps.exif_transpose(image).convert("RGB")
            image.thumbnail((1000, 1000))
            # New pixel-only image discards EXIF, embedded text and profiles.
            clean = Image.new("RGB", image.size)
            clean.paste(image)
            output = io.BytesIO()
            clean.save(output, "JPEG", quality=75)
        return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode()
    except Exception as error:
        raise HTTPException(
            422, "Use a JPEG, PNG or WebP image under 2 MB and 12 megapixels."
        ) from error


def public_report(row, at=None):
    at = at or now()
    result = dict(row.payload)
    if datetime.fromisoformat(result["expires_at"]) <= at:
        result["verification_status"] = "EXPIRED REPORT"
    return result


def active_rows():
    with Session.begin() as db:
        db.execute(delete(Observation).where(Observation.expires_at < now() - timedelta(days=1)))
        return list(
            db.scalars(
                select(Observation)
                .where(Observation.expires_at > now())
                .order_by(Observation.expires_at.desc())
                .limit(1000)
            )
        )


@router.post("/reports")
async def create_report(report: Report):
    stamp = now()
    if report.category not in CATEGORIES:
        raise HTTPException(422, "Unknown category")
    if not stamp - timedelta(hours=3) <= report.timestamp <= stamp + timedelta(minutes=5):
        raise HTTPException(422, "Reports must be from the last three hours, not the future.")
    photo = clean_photo(report.photo)
    # Neither exact coordinates nor arbitrary place names enter storage.
    lat, lon = round(report.location.latitude, 2), round(report.location.longitude, 2)
    loc = Location(
        latitude=lat, longitude=lon, name="Approximate area", timezone=report.location.timezone
    )
    bundle = await service.get(loc, "live_only", "pleasant")
    checks = [
        "Coordinates are in range; GPS ownership is not authenticated.",
        "Timestamp is recent.",
    ]
    score = 20
    metrics = bundle.current.metrics
    checks_map = {
        "heavy_rain": ("precipitation", 2),
        "strong_wind": ("wind", 35),
        "extreme_heat": ("temperature", 35),
    }
    corroborated = False
    if bundle.status not in ("unavailable", "simulated", "cached"):
        if report.category in checks_map:
            key, threshold = checks_map[report.category]
            v = value(metrics, key)
            corroborated = v is not None and v >= threshold
        elif report.category == "dense_fog":
            v = value(metrics, "visibility")
            corroborated = v is not None and v < 1000
        elif report.category == "thunderstorm":
            corroborated = bundle.current.code in (95, 96, 99)
    if corroborated:
        score += 25
    checks.append(
        "Provider supports weather context, not the incident."
        if corroborated
        else "No fresh provider corroboration; local incidents may differ from a model grid."
    )
    rows = active_rows()
    fingerprint = hashlib.sha256(
        f"{lat},{lon}|{report.category}|{' '.join(report.description.casefold().split())}|{photo or ''}".encode()
    ).hexdigest()
    if any(
        row.private.get("fingerprint") == fingerprint
        and datetime.fromisoformat(row.private["submitted_at"]) > stamp - timedelta(minutes=10)
        for row in rows
    ):
        raise HTTPException(
            409,
            "A matching report was submitted in this area recently. View existing reports or try again later.",
        )
    neighbours = sum(
        r.payload["category"] == report.category
        and distance(lat, lon, r.payload["latitude"], r.payload["longitude"]) <= 2
        for r in rows
    )
    # Anonymous duplicates are NOT independent votes; no confidence boost.
    checks.append(
        f"{neighbours} nearby matching reports; independence is unverified, no confidence boost."
    )
    if photo:
        score += 5
        checks.append("Photo decodes; metadata removed. Content and capture time are unverified.")
    expires = report.timestamp + timedelta(hours=4)
    payload = dict(
        report_id=str(uuid4()),
        latitude=lat,
        longitude=lon,
        approximate_location=f"Area near {lat:.2f}, {lon:.2f} (rounded ~1 km)",
        timestamp=report.timestamp.isoformat(),
        category=report.category,
        description="Description awaiting privacy review.",
        photo=None,
        verification_status="COMMUNITY OBSERVATION" if corroborated else "UNVERIFIED REPORT",
        confidence_score=score,
        confidence_basis=checks,
        expires_at=expires.isoformat(),
        source="Citizen observation — not government verified",
        status="community_unverified",
        confirming_reports=neighbours,
        confirmation_note="Matching reports, not independent confirmations",
    )
    token = secrets.token_urlsafe(32)
    row = Observation(
        id=payload["report_id"],
        payload=payload,
        private={
            "description": report.description,
            "photo": photo,
            "fingerprint": fingerprint,
            "submitted_at": stamp.isoformat(),
        },
        owner_hash=hashlib.sha256(token.encode()).hexdigest(),
        expires_at=expires,
    )
    with Session.begin() as db:
        db.execute(delete(Observation).where(Observation.expires_at < stamp - timedelta(days=1)))
        db.add(row)
    return {"report": payload, "delete_token": token}


@router.get("/reports")
def list_reports(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180)):
    results = []
    for row in active_rows():
        p = public_report(row)
        km = distance(latitude, longitude, p["latitude"], p["longitude"])
        if km <= 25:
            results.append({**p, "distance_km": round(km, 1)})
    return {
        "reports": sorted(results, key=lambda p: p["distance_km"])[:100],
        "retrieved_at": now(),
        "source": "Community observations",
        "notice": "Coarse locations. Reports may be inaccurate; no reports does not mean no hazards.",
    }


class DeleteReport(BaseModel):
    token: str = Field(max_length=100)


@router.post("/reports/{report_id}/delete")
def remove_report(report_id: str, request: DeleteReport):
    with Session.begin() as db:
        row = db.get(Observation, report_id)
        if not row or not secrets.compare_digest(
            row.owner_hash, hashlib.sha256(request.token.encode()).hexdigest()
        ):
            raise HTTPException(403, "Invalid report receipt")
        db.delete(row)
    return {"deleted": True}


class Review(BaseModel):
    token: str = Field(max_length=200)
    verified: bool = False
    public_description: str = Field(default="", max_length=500)
    evidence_note: str = Field(min_length=20, max_length=500)
    privacy_checked: bool


@router.post("/reports/{report_id}/review")
def review_report(report_id: str, request: Review):
    if not settings.community_review_token or not secrets.compare_digest(
        request.token, settings.community_review_token
    ):
        raise HTTPException(403, "Reviewer credentials required")
    if not request.privacy_checked:
        raise HTTPException(422, "Human privacy review is required")
    with Session.begin() as db:
        row = db.get(Observation, report_id)
        if not row or public_report(row)["verification_status"] == "EXPIRED REPORT":
            raise HTTPException(404, "Active report not found")
        row.payload = {
            **row.payload,
            "description": request.public_description,
            "verification_status": "VERIFIED LOCAL REPORT"
            if request.verified
            else "COMMUNITY OBSERVATION",
            "status": "community_verified" if request.verified else "community_unverified",
            "review": {
                "at": now().isoformat(),
                "note": request.evidence_note,
                "authority": "Local project reviewer, not a government authority",
            },
        }
        # Photos stay private even after text review; visible faces/addresses require manual redaction.
        return public_report(row)


@router.post("/review-queue")
def review_queue(request: DeleteReport):
    if not settings.community_review_token or not secrets.compare_digest(
        request.token, settings.community_review_token
    ):
        raise HTTPException(403, "Reviewer credentials required")
    return [
        {"report": public_report(row), "private_evidence": row.private}
        for row in active_rows()[:50]
    ]
