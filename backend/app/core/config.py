import json
from pathlib import Path

from pydantic import AwareDatetime, BaseModel, Field, HttpUrl, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class EmergencyContact(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    phone: str = Field(pattern=r"^[+0-9 -]{5,20}$")
    area: str = Field(min_length=1, max_length=120)
    source_url: HttpUrl
    checked_at: AwareDatetime


class Settings(BaseSettings):
    emergency_contacts: list[EmergencyContact] = Field(default_factory=list, max_length=20)
    community_review_token: str = ""
    geocoder_url: str = "https://photon.komoot.io"
    worldtides_api_key: str = ""
    tomtom_api_key: str = ""
    database_url: str = "sqlite:///./mausam.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    provider_timeout: float = Field(default=15, gt=0, le=120)
    cache_fresh_seconds: int = Field(default=900, gt=0)
    cache_max_seconds: int = Field(default=10800, gt=0)
    rate_limit_per_minute: int = Field(default=90, ge=1)
    demo_fallback: bool = False  # Legacy setting; automatic demo fallback is disabled.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def validate_cache_lifetimes(self):
        if self.cache_fresh_seconds > self.cache_max_seconds:
            raise ValueError("Fresh cache lifetime must not exceed the maximum cache age")
        return self


settings = Settings()
POLICIES = json.loads((Path(__file__).parent / "policies.json").read_text())
