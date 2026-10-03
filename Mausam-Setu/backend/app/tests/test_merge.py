import pytest

from app.providers.demo import fixture
from app.providers.open_meteo import OpenMeteoWeather
from app.recommendations.policies import exposure
from app.schemas.weather import Location, Profile
from app.services.locations import LocationService
from app.services.weather import WeatherService
from app.tests.test_service import Fail


@pytest.mark.asyncio
async def test_provider_only_mode_never_uses_simulated_fallback(monkeypatch):
    monkeypatch.setattr("app.services.weather.get_snapshot", lambda key: None)
    service = WeatherService([Fail()], Fail(), Fail(), Fail())
    assert (await service.get(Location(), mode="live_only")).status == "unavailable"
    assert (await service.get(Location(), mode="live")).status == "unavailable"


@pytest.mark.asyncio
async def test_new_metrics_use_provider_values_and_missing_stays_missing(monkeypatch):
    async def request(*args):
        return {
            "current": {"time": 1781505000, "temperature_2m": 30},
            "hourly": {"time": [1781505000], "surface_pressure": [995], "dew_point_2m": [19]},
            "daily": {"time": []},
        }

    monkeypatch.setattr("app.providers.open_meteo.request", request)
    bundle = await OpenMeteoWeather().fetch(Location())
    assert bundle.current.metrics["pressure"].value == 995
    assert bundle.current.metrics["dew_point"].value == 19
    assert bundle.current.metrics["wind_direction"].status == "unavailable"


def photon_feature(country="IN"):
    return {
        "geometry": {"coordinates": [80.95, 26.85]},
        "properties": {
            "countrycode": country,
            "country": "India",
            "name": "Hazratganj",
            "city": "Lucknow",
            "state": "Uttar Pradesh",
            "postcode": "226001",
        },
    }


@pytest.mark.asyncio
async def test_detailed_search_keeps_indian_results_and_postcode(monkeypatch):
    service = LocationService()

    async def request(*args):
        return {"features": [photon_feature(), photon_feature("US"), {}]}

    monkeypatch.setattr(service, "request", request)
    results = await service.search("226001")
    assert len(results) == 1
    assert "226001" in results[0].name
    assert results[0].timezone == "Asia/Kolkata"


@pytest.mark.asyncio
async def test_reverse_geocoding_preserves_gps_coordinates(monkeypatch):
    service = LocationService()

    async def request(*args):
        return {"features": [photon_feature()]}

    monkeypatch.setattr(service, "request", request)
    original = Location(latitude=26.84, longitude=80.94)
    result = await service.reverse(original)
    assert result.latitude == original.latitude
    assert result.longitude == original.longitude
    assert "Hazratganj" in result.name


@pytest.mark.asyncio
async def test_reverse_failure_keeps_usable_location(monkeypatch):
    service = LocationService()

    async def request(*args):
        raise ValueError("invalid provider response")

    monkeypatch.setattr(service, "request", request)
    original = Location()
    assert await service.reverse(original) == original


def test_high_humidity_is_explained_and_demo_metrics_are_labelled():
    bundle = fixture(Location(), "rain")
    insight = exposure(bundle, Profile(interests=["health"]))
    assert "humidity" in insight["message"]
    assert "humidity" in insight["metrics"]
    assert bundle.current.metrics["pressure"].status == "simulated"
