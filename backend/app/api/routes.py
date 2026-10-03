from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool

from app.core.config import POLICIES
from app.personalization.engine import compose
from app.providers.demo import SCENARIOS
from app.providers.open_meteo import OpenMeteoLocations
from app.schemas.integration import IntegrationContext
from app.schemas.weather import (
    DailyForecast,
    Home,
    Location,
    Metric,
    Profile,
    WeatherAlert,
    WeatherPoint,
)
from app.services.weather import service

router = APIRouter(prefix="/api")


async def context(
    latitude: float = Query(26.8467, ge=-90, le=90),
    longitude: float = Query(80.9462, ge=-180, le=180),
    name: str = Query("Lucknow", min_length=1, max_length=120),
    country: str = Query("India", max_length=80),
    timezone: str = "Asia/Kolkata",
    mode: Literal["live", "live_only", "demo"] = "live",
    scenario: str = "pleasant",
    interests: str = Query("fitness,health", max_length=150),
    activity: str = Query("general", max_length=40),
    planning: str = Query("{}", max_length=4000),
    preference_weights: str = Query("{}", max_length=500),
    learned_weights: str = Query("{}", max_length=500),
):
    if scenario not in SCENARIOS:
        raise HTTPException(422, "Unknown scenario")
    try:
        loc = Location(
            name=name, latitude=latitude, longitude=longitude, timezone=timezone, country=country
        )
        import json

        profile = Profile(
            interests=interests.split(",") if interests else [],
            activity=activity,
            planning=json.loads(planning),
            preference_weights=json.loads(preference_weights),
            learned_weights=json.loads(learned_weights),
        )
    except (ValidationError, ValueError, TypeError):
        raise HTTPException(422, "Invalid location, timezone or interests")
    bundle = await service.get(loc, mode, scenario, "marine" in profile.interests)
    return bundle, profile


@router.get("/home/personalized", response_model=Home)
async def home(ctx=Depends(context)):
    return compose(*ctx)


@router.get("/weather/current", response_model=WeatherPoint)
async def current(ctx=Depends(context)):
    return ctx[0].current


@router.get("/weather/hourly", response_model=list[WeatherPoint])
async def hourly(ctx=Depends(context)):
    return ctx[0].hourly


@router.get("/weather/daily", response_model=list[DailyForecast])
async def daily(ctx=Depends(context)):
    return ctx[0].daily


@router.get("/air-quality", response_model=dict[str, Metric])
async def air(ctx=Depends(context)):
    return ctx[0].air_quality


@router.get("/marine", response_model=dict[str, Metric])
async def marine(ctx=Depends(context)):
    return ctx[0].marine


@router.get("/alerts", response_model=list[WeatherAlert])
async def alerts(ctx=Depends(context)):
    return compose(*ctx).priority_alerts


@router.get("/locations/search", response_model=list[Location])
async def locations(
    q: str = Query(min_length=2, max_length=100), scope: Literal["cities", "india"] = "cities"
):
    if scope == "india":
        from app.services.locations import location_service

        try:
            return await location_service.search(q)
        except Exception:
            raise HTTPException(
                503, "Detailed place search unavailable. Try city search or a saved place."
            )
    try:
        return await OpenMeteoLocations().search(q)
    except Exception:
        raise HTTPException(503, "Location search unavailable. Use a saved or predefined location.")


@router.get("/config")
async def config():
    return {
        "personas": POLICIES["personas"],
        "scenarios": {k: v["label"] for k, v in SCENARIOS.items()},
        "alert_cooldown_seconds": POLICIES["alert_cooldown_seconds"],
    }


@router.get("/locations/reverse", response_model=Location)
async def reverse_location(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    timezone: str = "UTC",
):
    from app.services.locations import location_service

    try:
        location = Location(
            name="My location",
            latitude=latitude,
            longitude=longitude,
            country="",
            timezone=timezone,
        )
    except ValueError:
        raise HTTPException(422, "Invalid timezone")
    return await location_service.reverse(location)


@router.get("/providers")
async def providers():
    from app.providers.india import provider_status

    return provider_status()


@router.get("/integration/v1/context", response_model=IntegrationContext)
async def integration_context(ctx=Depends(context)):
    """Versioned renderer-neutral contract; no connection to an official app is implied."""
    from app.services.community import list_reports

    bundle, profile = ctx
    result = compose(bundle, profile)
    if bundle.scenario and bundle.status in ("simulated", "unavailable"):
        community = {
            "reports": [],
            "status": "simulated",
            "notice": "Demo context: live citizen reports are excluded.",
        }
    else:
        try:
            community = await run_in_threadpool(
                list_reports, bundle.location.latitude, bundle.location.longitude
            )
            community["status"] = "community_unverified"
        except SQLAlchemyError:
            community = {
                "reports": [],
                "status": "unavailable",
                "notice": "Community reports are temporarily unavailable. Retry shortly.",
            }
    return {
        "schema_version": "1.0",
        "user_context": {
            "location": bundle.location,
            "profile": profile,
            "reference_time": bundle.reference_time,
        },
        "weather": {
            "current": result.current_weather,
            "hourly": result.hourly,
            "daily": result.daily,
            "air_quality": result.air_quality,
            "marine": result.marine,
            "data_status": result.data_status,
        },
        "weather_risk": result.weather_risk,
        "safety": result.safety,
        "official_alerts": result.safety.get("official_warnings", []),
        "homepage_layout": result.homepage_layout,
        "recommendations": result.personalized_sections,
        "priority_alerts": result.priority_alerts,
        "planning": result.planning,
        "community_conditions": community["reports"],
        "community_status": {key: val for key, val in community.items() if key != "reports"},
        "data_sources": result.provider_status,
        "generated_at": result.generated_at,
    }
