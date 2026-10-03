from typing import Protocol

from app.schemas.weather import Location, Metric, WeatherAlert, WeatherBundle


class WeatherProvider(Protocol):
    async def fetch(self, location: Location) -> WeatherBundle: ...


class AirQualityProvider(Protocol):
    async def fetch(self, location: Location) -> dict[str, Metric]: ...


class MarineProvider(AirQualityProvider, Protocol):
    pass


class AlertProvider(Protocol):
    async def fetch(self, location: Location) -> list[WeatherAlert]: ...


class LocationProvider(Protocol):
    async def search(self, query: str) -> list[Location]: ...


class TrafficProvider(Protocol):
    async def fetch(self, location: Location) -> dict: ...


class UnavailableTraffic:
    async def fetch(self, location):
        return {"status": "unavailable", "message": "Traffic data unavailable."}


class UnavailableOfficialAlerts:
    async def fetch(self, location):
        return []
