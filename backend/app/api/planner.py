import asyncio
from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.providers.demo import SCENARIOS
from app.providers.extras import aviation, tides, traffic
from app.recommendations.planning import assessment, period
from app.schemas.weather import Location
from app.services.weather import service
from app.utils.time import resolve_local_time, utc

router = APIRouter(prefix="/api/planner")


class Journey(BaseModel):
    origin: Location
    destination: Location
    departure: datetime
    arrival: datetime
    kind: Literal["commute", "school", "flight"] = "commute"
    mode: Literal["live", "live_only", "demo"] = "live"
    scenario: str = Field(default="pleasant", max_length=40)
    transport: Literal["car", "bicycle", "pedestrian", "bus", "motorcycle"] = "car"
    departure_icao: str = Field(default="", pattern=r"^([A-Z]{4})?$")
    arrival_icao: str = Field(default="", pattern=r"^([A-Z]{4})?$")


class Coast(BaseModel):
    location: Location
    day: date
    mode: Literal["live", "live_only", "demo"] = "live"


@router.post("/journey")
async def journey(plan: Journey):
    if plan.scenario not in SCENARIOS:
        raise HTTPException(422, "Unknown scenario")
    try:
        departure = resolve_local_time(plan.departure, plan.origin.timezone)
        arrival = resolve_local_time(plan.arrival, plan.destination.timezone)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    duration = utc(arrival) - utc(departure)
    if duration <= timedelta(0) or duration > timedelta(days=2):
        raise HTTPException(422, "Arrival must follow departure by at most 48 hours")
    bundles = await asyncio.gather(
        service.get(plan.origin, plan.mode, plan.scenario),
        service.get(plan.destination, plan.mode, plan.scenario),
    )
    results = []
    for label, bundle, at in zip(["Departure", "Arrival"], bundles, [departure, arrival]):
        result = assessment(period(bundle, at, 1))
        results.append(
            {
                "label": label,
                "location": bundle.location.name,
                "at": at,
                "timezone": bundle.location.timezone,
                "status": bundle.status,
                "source": bundle.source,
                **result,
            }
        )
    extra = {}
    if plan.kind == "flight":
        reports = await asyncio.gather(
            aviation(plan.departure_icao, plan.origin, departure, plan.mode),
            aviation(plan.arrival_icao, plan.destination, arrival, plan.mode),
        )
        extra["airports"] = [
            {"label": "Departure airport", **reports[0]},
            {"label": "Arrival airport", **reports[1]},
        ]
    else:
        extra["traffic"] = await traffic(
            plan.origin, plan.destination, departure, plan.mode, plan.transport
        )
        from app.services.route_weather import route_weather

        extra["route_weather"] = await route_weather(plan, extra["traffic"], departure)
    from app.utils.calculations import value

    origin_temp = value(bundles[0].current.metrics, "temperature")
    destination_temp = value(bundles[1].current.metrics, "temperature")
    difference = (
        destination_temp - origin_temp
        if origin_temp is not None and destination_temp is not None
        else None
    )
    packing = ["Water and necessary personal items"]
    if any("Rain" in r.get("concerns", []) for r in results):
        packing.append("Rain protection")
    if any("Heat" in r.get("concerns", []) or "High UV" in r.get("concerns", []) for r in results):
        packing.append("Sun protection")
    return {
        "comparison": {
            "temperature_difference_c": difference,
            "message": f"Current destination temperature differs by {difference:+.1f} °C from origin; this is not arrival-time temperature."
            if difference is not None
            else "Current temperature comparison unavailable.",
            "packing": packing,
        },
        "endpoints": results,
        **extra,
        "scope": "Endpoint forecasts plus five approximate route samples when provider geometry is available. Not navigation or a route safety guarantee.",
        "official_warning_url": "https://mausam.imd.gov.in/",
        "official_warning_status": "unavailable",
        "flight_status": "Not connected" if plan.kind == "flight" else None,
    }


@router.post("/tides")
async def coast(plan: Coast):
    if plan.mode != "demo" and settings.worldtides_api_key:
        # A verified nearby sea grid is required before requesting a paid tide lookup.
        bundle = await service.get(plan.location, "live", "pleasant", True)
        if not bundle.marine:
            return {
                "status": "unavailable",
                "message": "No nearby marine grid was available. Select a coastal location.",
            }
    return await tides(plan.location, plan.day, plan.mode)


class SavedPlan(BaseModel):
    location: Location
    start: datetime
    hours: float = Field(ge=0.5, le=24)
    activity: str = Field(default="Outdoor event", max_length=80)
    indoor_backup: bool = False
    mode: Literal["live", "live_only", "demo"] = "live"
    scenario: str = "pleasant"


@router.post("/evaluate")
async def evaluate_plan(plan: SavedPlan):
    if plan.scenario not in SCENARIOS:
        raise HTTPException(422, "Unknown scenario")
    try:
        start = resolve_local_time(plan.start, plan.location.timezone)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    bundle = await service.get(plan.location, plan.mode, plan.scenario)
    points = period(bundle, start, plan.hours)
    result = assessment(points)
    return {
        **result,
        "start": start,
        "end": start + timedelta(hours=plan.hours),
        "source": bundle.source,
        "status": bundle.status,
        "retrieved_at": bundle.retrieved_at,
        "location": plan.location,
        "activity": plan.activity,
        "risk": "Concerns flagged"
        if result.get("concerns")
        else "No screening thresholds triggered"
        if result["available"]
        else "Unavailable",
        "rain_timing": [
            p.time
            for p in points
            if p.metrics.get("rain_probability")
            and p.metrics["rain_probability"].value is not None
            and p.metrics["rain_probability"].value >= 60
        ],
        "aqi": result.get("aqi", "Hourly AQI unavailable for this period."),
        "backup": "Use your indoor backup if concerns persist."
        if plan.indoor_backup
        else "Arrange an indoor backup when concerns are flagged.",
    }
