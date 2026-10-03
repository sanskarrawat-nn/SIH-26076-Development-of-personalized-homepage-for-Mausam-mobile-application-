from datetime import date, datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import AwareDatetime, BaseModel, Field, field_validator, model_validator

Status = Literal[
    "live",
    "cached",
    "estimated",
    "simulated",
    "unavailable",
    "community_verified",
    "community_unverified",
]
Persona = Literal[
    "health",
    "fitness",
    "travel",
    "family",
    "agriculture",
    "commute",
    "marine",
    "events",
    "student",
    "hill",
]


def now():
    return datetime.now(timezone.utc)


class Location(BaseModel):
    name: str = Field(default="Lucknow", min_length=1, max_length=120)
    latitude: float = Field(default=26.8467, ge=-90, le=90)
    longitude: float = Field(default=80.9462, ge=-180, le=180)
    country: str = Field(default="India", max_length=80)
    timezone: str = "Asia/Kolkata"

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, v):
        try:
            ZoneInfo(v)
        except Exception:
            raise ValueError("Unknown timezone")
        return v


class Metric(BaseModel):
    value: float | None = Field(default=None, allow_inf_nan=False)
    unit: str
    source: str
    retrieved_at: AwareDatetime
    valid_at: AwareDatetime
    location: Location
    status: Status

    expires_at: AwareDatetime | None = None
    quality: Literal["medium", "low", "unavailable"] = "medium"

    @model_validator(mode="after")
    def provenance(self):
        if self.expires_at is None:
            from app.core.config import settings

            self.expires_at = self.retrieved_at + timedelta(seconds=settings.cache_max_seconds)
        if self.value is None or self.status == "unavailable":
            self.value = None
            self.status = "unavailable"
            self.quality = "unavailable"
        elif self.status in ("cached", "simulated", "community_unverified"):
            self.quality = "low"
        return self


class OfficialWarning(BaseModel):
    id: str
    authority: Literal["IMD", "NDMA", "INCOIS"]
    title: str
    message: str
    severity: Literal["info", "caution", "warning", "severe"]
    location: Location
    issued_at: AwareDatetime
    start_time: AwareDatetime
    end_time: AwareDatetime
    source_url: str
    status: Literal["live", "cached", "simulated"]

    @field_validator("source_url")
    @classmethod
    def secure_source(cls, value):
        from urllib.parse import urlsplit

        parsed = urlsplit(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Warning source must be an HTTPS URL without credentials")
        return value

    @model_validator(mode="after")
    def valid_period(self):
        if self.end_time <= self.start_time or self.issued_at > self.end_time:
            raise ValueError("Invalid warning validity period")
        return self


class WeatherPoint(BaseModel):
    time: AwareDatetime
    metrics: dict[str, Metric] = Field(default_factory=dict)
    code: int | None = None


class DailyForecast(BaseModel):
    date: str
    metrics: dict[str, Metric] = Field(default_factory=dict)
    sunrise: AwareDatetime | None = None
    sunset: AwareDatetime | None = None


class WeatherBundle(BaseModel):
    location: Location
    current: WeatherPoint
    hourly: list[WeatherPoint] = Field(default_factory=list)
    daily: list[DailyForecast] = Field(default_factory=list)
    air_quality: dict[str, Metric] = Field(default_factory=dict)
    marine: dict[str, Metric] = Field(default_factory=dict)
    status: Status
    retrieved_at: AwareDatetime
    reference_time: AwareDatetime
    source: str
    notices: list[str] = Field(default_factory=list)
    scenario: str | None = None
    official_warnings: list[OfficialWarning] = Field(default_factory=list)


class Planning(BaseModel):
    student_activity: Literal["sports", "walking", "none"] = "sports"
    student_start: str = Field(default="09:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    student_end: str = Field(default="16:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    practice_time: str = Field(default="17:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    commute_departure: str = Field(default="08:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    commute_return: str = Field(default="18:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    commute_minutes: int = Field(default=30, ge=5, le=240)
    transport_mode: Literal["car", "bicycle", "pedestrian", "bus", "motorcycle"] = "car"
    growth_stage: Literal["unspecified", "seedling", "vegetative", "flowering", "maturity"] = (
        "unspecified"
    )
    sensitivities: list[Literal["air", "pollen", "sun", "heat"]] = Field(
        default_factory=list, max_length=4
    )
    exercise: Literal["running", "walking", "cycling"] = "running"
    intensity: Literal["light", "moderate", "vigorous"] = "moderate"
    duration_minutes: int = Field(default=60, ge=30, le=240, multiple_of=30)
    preferred_start: int = Field(default=5, ge=0, le=23)
    preferred_end: int = Field(default=20, ge=1, le=24)
    school_dropoff: str = Field(default="08:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    school_pickup: str = Field(default="14:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    event_date: date | None = None
    event_start: str = Field(default="17:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    event_hours: int = Field(default=3, ge=1, le=12)
    event_shelter: bool = False
    crop: Literal["none", "tomato", "okra", "wheat_hd3226"] = "none"
    growing_region: Literal["unspecified", "south_india", "tamil_nadu", "north_western_plains"] = (
        "unspecified"
    )
    planting_date: date | None = None

    @model_validator(mode="after")
    def valid_hours(self):
        if self.preferred_end <= self.preferred_start:
            raise ValueError("Preferred end must follow start")
        return self


class Profile(BaseModel):
    interests: list[Persona] = Field(default_factory=lambda: ["fitness", "health"], max_length=10)
    activity: str = Field(default="general", max_length=40)
    units: Literal["metric", "imperial"] = "metric"
    notifications: bool = False
    planning: Planning = Field(default_factory=Planning)
    preference_weights: dict[Persona, float] = Field(default_factory=dict)
    learned_weights: dict[Persona, float] = Field(default_factory=dict)

    @field_validator("preference_weights", "learned_weights")
    @classmethod
    def bounded_weights(cls, weights):
        if any(not 0 <= number <= 2 for number in weights.values()):
            raise ValueError("Preference weights must be between 0 and 2")
        return weights

    @field_validator("interests")
    @classmethod
    def deduplicate(cls, v):
        return list(dict.fromkeys(v))


class Recommendation(BaseModel):
    id: str
    type: str
    title: str
    message: str
    priority: float
    timestamp: AwareDatetime
    expires_at: AwareDatetime
    source: str
    status: Status
    quality: Literal["high", "medium", "low", "unavailable"]
    reasons: list[str]
    personas: list[str]
    score_breakdown: dict[str, float]
    metrics: list[str] = Field(default_factory=list)
    rule_metadata: dict = Field(default_factory=dict)
    message_code: str = ""
    window_start: AwareDatetime | None = None
    window_end: AwareDatetime | None = None


class WeatherAlert(BaseModel):
    id: str
    type: str
    severity: Literal["info", "caution", "warning", "severe"]
    location: Location
    start_time: AwareDatetime
    end_time: AwareDatetime
    message: str
    reason: str
    source: str
    status: Status
    notification_due: bool = False


class Home(BaseModel):
    location: Location
    current_weather: WeatherPoint
    today_for_you: list[Recommendation]
    priority_alerts: list[WeatherAlert]
    hourly: list[WeatherPoint]
    daily: list[DailyForecast]
    personalized_sections: list[Recommendation]
    air_quality: dict[str, Metric]
    marine: dict[str, Metric]
    data_status: dict
    generated_at: AwareDatetime
    reference_time: AwareDatetime
    planning: dict = Field(default_factory=dict)
    weather_risk: dict = Field(default_factory=dict)
    safety: dict = Field(default_factory=dict)
    homepage_layout: list[dict] = Field(default_factory=list)
    provider_status: list[dict] = Field(default_factory=list)
    configured_contacts: list[dict] = Field(default_factory=list)
