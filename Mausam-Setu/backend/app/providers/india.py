"""India-first extension boundary, without fabricated upstream API access.

An authorized provider-specific loader must normalize its payload to this
contract and resolve geographic coverage before calling accept(). No browser
or public endpoint can submit an official warning. Unconfigured adapters make
no network calls and explicitly report unavailable.
"""

from pydantic import BaseModel, Field

from app.core.config import settings
from app.schemas.weather import Location, Metric, OfficialWarning, now


class ProviderResult(BaseModel):
    authority: str
    location: Location
    metrics: dict[str, Metric] = Field(default_factory=dict)
    warnings: list[OfficialWarning] = Field(default_factory=list)
    notices: list[str] = Field(default_factory=list)
    status: str = "unavailable"


class IndiaProviderAdapter:
    def __init__(self, authority, purpose, website, loader=None):
        self.authority = authority
        self.purpose = purpose
        self.website = website
        self.loader = loader

    async def fetch(self, location):
        if self.loader is None:
            return ProviderResult(
                authority=self.authority,
                location=location,
                notices=["Authorized data access and payload mapping are not configured."],
            )
        return self.accept(await self.loader(location), location)

    def accept(self, payload, location):
        result = ProviderResult.model_validate(payload)
        if result.authority != self.authority or result.location != location:
            raise ValueError("Provider identity or resolved location mismatch")
        reference = now()
        for metric in result.metrics.values():
            if metric.location != location or metric.status in (
                "simulated",
                "community_unverified",
                "community_verified",
            ):
                raise ValueError("Invalid official metric provenance")
            if metric.retrieved_at > reference or metric.expires_at <= reference:
                raise ValueError("Expired or future-dated metric")
        for warning in result.warnings:
            if warning.authority != self.authority or warning.location != location:
                raise ValueError("Warning authority or coverage mismatch")
            if (
                warning.status == "simulated"
                or warning.issued_at > reference
                or warning.end_time <= reference
            ):
                raise ValueError("Invalid official warning validity")
        if self.authority == "CPCB" and any(
            m.unit != "Indian NAQI" for k, m in result.metrics.items() if k == "indian_aqi"
        ):
            raise ValueError("Indian AQI scale must be explicit; no US AQI conversion")
        return result


ADAPTERS = [
    IndiaProviderAdapter(
        "IMD", "Forecast, nowcast and official warnings", "https://mausam.imd.gov.in/"
    ),
    IndiaProviderAdapter(
        "CPCB", "Indian National AQI with station metadata", "https://cpcb.nic.in/"
    ),
    IndiaProviderAdapter(
        "INCOIS", "Marine, tides and coastal advisories", "https://incois.gov.in/"
    ),
    IndiaProviderAdapter("ICAR", "Regional crop advisories", "https://icar.gov.in/"),
    IndiaProviderAdapter(
        "NDMA", "Disaster advisories and safety information", "https://ndma.gov.in/"
    ),
]


def provider_status():
    official = [
        {
            "provider": adapter.authority,
            "purpose": adapter.purpose,
            "status": "unavailable",
            "configured": adapter.loader is not None,
            "website": adapter.website,
            "message": "Integration contract ready; live access and provider mapping not configured.",
        }
        for adapter in ADAPTERS
    ]

    public = [
        (
            "Open-Meteo weather",
            "Weather, hourly/daily, soil",
            "https://open-meteo.com/",
            True,
            "Primary best_match; secondary GFS model; valid cache; unavailable. Both models use the same provider.",
        ),
        (
            "Open-Meteo CAMS",
            "US AQI and regional pollen",
            "https://open-meteo.com/",
            True,
            "Model estimates; US AQI is not Indian NAQI. Pollen coverage excludes India.",
        ),
        (
            "Open-Meteo Marine",
            "Offshore model waves",
            "https://open-meteo.com/",
            True,
            "Nearby sea-grid screening only; not harbour safety or astronomical tide predictions.",
        ),
        (
            "Open-Meteo Geocoding",
            "City search",
            "https://open-meteo.com/",
            True,
            "User-triggered search; saved/predefined locations remain usable on failure.",
        ),
        (
            "Photon",
            "Detailed place search and reverse geocoding",
            "https://photon.komoot.io/",
            bool(settings.geocoder_url),
            "Configure an operator-controlled service for production volume.",
        ),
        (
            "NOAA Aviation Weather",
            "METAR/TAF airport bulletins",
            "https://aviationweather.gov/",
            True,
            "Not flight delay, runway clearance or operational flight status.",
        ),
        (
            "TomTom",
            "Traffic routes",
            "https://www.tomtom.com/",
            bool(settings.tomtom_api_key),
            "Optional backend key; five route samples when geometry is available. No booking or navigation guarantee.",
        ),
        (
            "WorldTides",
            "Predicted tide extrema",
            "https://www.worldtides.info/",
            bool(settings.worldtides_api_key),
            "Optional backend key; predicted tides are estimated, not observed sea level.",
        ),
    ]
    return official + [
        {
            "provider": name,
            "purpose": purpose,
            "website": website,
            "configured": configured,
            "status": "configured" if configured else "unavailable",
            "message": (
                "Adapter configured; availability is determined per request. "
                if configured
                else "Not configured. "
            )
            + note,
        }
        for name, purpose, website, configured, note in public
    ]
