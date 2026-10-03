import base64
import io
from datetime import timedelta

import pytest
from fastapi import HTTPException
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.planner import Journey, SavedPlan, evaluate_plan, journey
from app.core.config import settings
from app.database.store import Base
from app.personalization.engine import compose
from app.providers.demo import fixture
from app.schemas.weather import Location, Planning, Profile, now
from app.services import community
from app.services.notifications import Candidate, NotificationPreferences, eligible
from app.services.route_weather import sample_route


@pytest.fixture
def reports(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    monkeypatch.setattr(community, "Session", sessionmaker(engine, expire_on_commit=False))

    async def weather(loc, *args):
        return fixture(loc, "missing")

    monkeypatch.setattr(community.service, "get", weather)
    yield
    engine.dispose()


def payload(**kwargs):
    return community.Report(
        category="waterlogging",
        location=Location(latitude=26.846734, longitude=80.946231, name="Private home 12"),
        timestamp=now(),
        **kwargs,
    )


@pytest.mark.asyncio
async def test_report_privacy_receipt_and_no_auto_verification(reports):
    created = await community.create_report(
        payload(description="My phone 9999999999 and home address")
    )
    report = created["report"]
    assert report["latitude"] == 26.85 and report["longitude"] == 80.95
    assert "999999" not in str(report) and "Private home" not in str(report)
    assert report["verification_status"] == "UNVERIFIED REPORT"
    assert report["photo"] is None
    public = community.list_reports(26.84, 80.94)
    assert len(public["reports"]) == 1
    assert "delete_token" not in str(public) and "owner_hash" not in str(public)
    with pytest.raises(HTTPException):
        community.remove_report(report["report_id"], community.DeleteReport(token="wrong"))
    community.remove_report(
        report["report_id"], community.DeleteReport(token=created["delete_token"])
    )
    assert community.list_reports(26.84, 80.94)["reports"] == []


@pytest.mark.asyncio
async def test_duplicates_do_not_boost_confidence(reports):
    a = await community.create_report(payload())
    b = await community.create_report(payload(description="Separate observation nearby"))
    assert a["report"]["confidence_score"] == b["report"]["confidence_score"]
    assert b["report"]["confirming_reports"] == 1


@pytest.mark.asyncio
async def test_expiry_and_moderation_auth(reports, monkeypatch):
    created = await community.create_report(payload())
    rid = created["report"]["report_id"]
    review = community.Review(
        token="wrong",
        verified=True,
        public_description="Road waterlogging",
        evidence_note="Reviewed independent local evidence.",
        privacy_checked=True,
    )
    with pytest.raises(HTTPException):
        community.review_report(rid, review)
    monkeypatch.setattr(settings, "community_review_token", "test-review-secret")
    reviewed = community.review_report(
        rid, review.model_copy(update={"token": "test-review-secret"})
    )
    assert reviewed["verification_status"] == "VERIFIED LOCAL REPORT"
    assert reviewed["review"]["authority"].endswith("not a government authority")
    with community.Session() as db:
        row = db.get(community.Observation, rid)
        assert (
            community.public_report(row, now() + timedelta(hours=5))["verification_status"]
            == "EXPIRED REPORT"
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("offset", [-4, 1])
async def test_reject_stale_future_reports(reports, offset):
    with pytest.raises(HTTPException):
        await community.create_report(
            payload().model_copy(update={"timestamp": now() + timedelta(hours=offset)})
        )


def test_photo_metadata_removed_and_invalid_rejected():
    image = Image.new("RGB", (20, 20), "red")
    exif = Image.Exif()
    exif[315] = "private photographer"
    exif[270] = "home address"
    data = io.BytesIO()
    image.save(data, "JPEG", exif=exif)
    cleaned = community.clean_photo(base64.b64encode(data.getvalue()).decode())
    with Image.open(io.BytesIO(base64.b64decode(cleaned.split(",")[1]))) as result:
        assert not result.getexif()
    with pytest.raises(HTTPException):
        community.clean_photo("not an image")


def test_student_full_schedule_and_highland_safety():
    student = compose(fixture(Location(), "student_commute"), Profile(interests=["student"]))
    assert len(student.planning["student"]) == 3
    assert student.planning["student"][0]["available"]
    assert student.planning["student"][0]["start"].hour == 8
    assert student.planning["student"][0]["start"].minute == 30
    assert "Rain" in student.planning["student"][0]["concerns"]
    hill = compose(fixture(Location(), "hill_fog"), Profile(interests=["hill"]))
    assert "not a landslide prediction" in hill.personalized_sections[0].message
    assert "Very low" in hill.personalized_sections[0].message


def test_marine_and_agriculture_provenance():
    home = compose(fixture(Location(), "coast"), Profile(interests=["marine", "agriculture"]))
    assert home.planning["coastal"]["status"] == "simulated"
    assert home.planning["coastal"]["score"] == 30
    assert "not a" in home.planning["coastal"]["formula"].lower()
    assert home.planning["agriculture"]["advisory_status"] == "ICAR adapter unconfigured"


def test_learning_never_changes_safety():
    bundle = fixture(Location(), "emergency")
    a = compose(bundle, Profile(interests=["student"], learned_weights={"student": 0}))
    b = compose(bundle, Profile(interests=["student"], learned_weights={"student": 2}))
    assert a.safety == b.safety and a.weather_risk == b.weather_risk
    assert a.homepage_layout[0]["widget_id"] == "safety"
    assert b.personalized_sections[0].priority > a.personalized_sections[0].priority


def test_distance_sampling_not_vertex_index():
    points = [{"latitude": 0, "longitude": lon} for lon in (0, 0.1, 0.2, 4)]
    samples = sample_route(points)
    assert [round(p["longitude"], 4) for p in samples] == [0, 1, 2, 3, 4]
    assert len(samples) == 5
    with pytest.raises(ValueError):
        sample_route(points, 100)
    with pytest.raises(ValueError):
        sample_route([points[0], points[0]])


@pytest.mark.asyncio
async def test_route_eta_matching_and_unavailable(monkeypatch):
    from app.services.weather import service

    async def weather(loc, mode, scenario):
        return fixture(loc, scenario)

    monkeypatch.setattr(service, "get", weather)
    bundle = fixture(Location(), "route_rain")
    plan = Journey(
        origin=Location(),
        destination=Location(latitude=27.5),
        departure=bundle.reference_time + timedelta(hours=3),
        arrival=bundle.reference_time + timedelta(hours=5),
        mode="demo",
        scenario="route_rain",
    )
    result = await journey(plan)
    samples = result["route_weather"]["samples"]
    assert len(samples) == 5
    assert samples[0]["at"] == plan.departure
    assert samples[-1]["at"] == plan.departure + timedelta(minutes=35)
    assert all(s["status"] == "simulated" and "Rain" in s["concerns"] for s in samples)
    monkeypatch.setattr(settings, "tomtom_api_key", "")
    live = await journey(
        plan.model_copy(
            update={
                "mode": "live",
                "departure": now() + timedelta(hours=1),
                "arrival": now() + timedelta(hours=2),
            }
        )
    )
    assert live["traffic"]["status"] == "unavailable"
    assert live["route_weather"]["samples"] == []


@pytest.mark.asyncio
async def test_saved_plan_full_duration_and_missing_coverage(monkeypatch):
    from app.services.weather import service

    bundle = fixture(Location(), "storm")

    async def weather(*args):
        return bundle

    monkeypatch.setattr(service, "get", weather)
    plan = SavedPlan(
        location=Location(),
        start=bundle.reference_time + timedelta(hours=3),
        hours=4,
        mode="demo",
        indoor_backup=True,
    )
    result = await evaluate_plan(plan)
    assert "Thunderstorms" in result["concerns"] and result["available"]
    assert result["end"] - result["start"] == timedelta(hours=4)
    result = await evaluate_plan(
        plan.model_copy(update={"start": bundle.reference_time + timedelta(days=8)})
    )
    assert not result["available"]


def test_notification_policy_cooldown_consent_severity_and_expiry():
    at = now()
    candidate = Candidate(
        id="rain-window",
        category="commute",
        severity="warning",
        status="estimated",
        expires_at=at + timedelta(hours=1),
        title="Commute rain",
        message="Allow extra time.",
    )
    preferences = NotificationPreferences(enabled=True, categories=["commute"])
    assert eligible(candidate, preferences, None, at)
    assert not eligible(candidate, preferences, at - timedelta(minutes=20), at)
    assert not eligible(candidate, preferences, None, at + timedelta(hours=2))
    assert not eligible(candidate, preferences.model_copy(update={"enabled": False}), None, at)
    assert not eligible(candidate.model_copy(update={"status": "simulated"}), preferences, None, at)
    assert not eligible(candidate, preferences.model_copy(update={"severity": "severe"}), None, at)


@pytest.mark.parametrize(
    "scenario",
    [
        "student_commute",
        "hill_fog",
        "community_flood",
        "verified_community",
        "route_rain",
        "emergency",
        "severe_aqi",
        "hindi_voice",
    ],
)
def test_new_demos_explicit_and_deterministic(scenario):
    a = fixture(Location(), scenario)
    b = fixture(Location(), scenario)
    assert a == b and a.status == "simulated"


def test_student_settings_reject_invalid_time():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        Planning(student_start="25:00")


@pytest.mark.asyncio
async def test_hourly_air_attached_by_timestamp_without_extra_requests(monkeypatch):
    from app.providers import open_meteo
    from app.recommendations.planning import assessment, period
    from app.services.weather import WeatherService

    loc = Location()
    weather = fixture(loc, "pleasant")
    calls = []

    async def request(url, params):
        calls.append(url)
        return {
            "current": {
                "time": weather.reference_time.timestamp(),
                "us_aqi": 50,
                "pm2_5": 10,
                "pm10": 15,
            },
            "hourly": {
                "time": [p.time.timestamp() for p in weather.hourly[:4]],
                "us_aqi": [50, 150, 180, None],
            },
        }

    monkeypatch.setattr(open_meteo, "request", request)

    class Weather:
        async def fetch(self, loc):
            return weather

    class Empty:
        async def fetch(self, loc):
            return {}

    service = WeatherService(
        providers=[Weather()], air=open_meteo.OpenMeteoAir(), soil=Empty(), official_providers=[]
    )

    async def no_cache(*args):
        pass

    monkeypatch.setattr(service, "_write_cache", no_cache)
    result = await service._fetch(loc, None, "test-hourly", False)
    assert len(calls) == 1
    window = assessment(period(result, result.reference_time + timedelta(hours=1), 2))
    assert window["peak_us_aqi"] == 180 and "Poor air quality" in window["concerns"]
    missing = assessment(period(result, result.reference_time + timedelta(hours=2), 2))
    assert missing["peak_us_aqi"] is None and "unavailable" in missing["aqi"]


def test_community_api_rejects_forged_review_fields(reports):
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    body = payload().model_dump(mode="json")
    body.update(verification_status="VERIFIED LOCAL REPORT", confidence_score=100)
    response = client.post("/api/community/reports", json=body)
    assert response.status_code == 200
    public = response.json()["report"]
    assert public["verification_status"] == "UNVERIFIED REPORT" and public["confidence_score"] < 100
    assert client.post("/api/community/review-queue", json={"token": "bad"}).status_code == 403
