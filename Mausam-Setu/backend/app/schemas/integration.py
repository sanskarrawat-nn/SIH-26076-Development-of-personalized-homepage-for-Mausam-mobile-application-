"""Renderer-independent v1 envelope; widget payloads reuse the shared composition."""

from typing import Literal

from pydantic import AwareDatetime, BaseModel

from app.schemas.weather import (
    DailyForecast,
    Location,
    Metric,
    OfficialWarning,
    Profile,
    Recommendation,
    WeatherAlert,
    WeatherPoint,
)


class UserContext(BaseModel):
    location: Location
    profile: Profile
    reference_time: AwareDatetime


class WeatherContext(BaseModel):
    current: WeatherPoint
    hourly: list[WeatherPoint]
    daily: list[DailyForecast]
    air_quality: dict[str, Metric]
    marine: dict[str, Metric]
    data_status: dict


class IntegrationContext(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    user_context: UserContext
    weather: WeatherContext
    weather_risk: dict
    safety: dict
    official_alerts: list[OfficialWarning]
    homepage_layout: list[dict]
    recommendations: list[Recommendation]
    priority_alerts: list[WeatherAlert]
    planning: dict
    community_conditions: list[dict]
    community_status: dict
    data_sources: list[dict]
    generated_at: AwareDatetime
