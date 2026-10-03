import pytest

from app.providers.open_meteo import OpenMeteoAir, OpenMeteoMarine, OpenMeteoWeather
from app.schemas.weather import Location


@pytest.mark.asyncio
async def test_weather_normalizes_partial_fields_and_time(monkeypatch):
    # A controlled contract fixture, not an observed provider response.
    fixture = {
        "timezone": "Asia/Kolkata",
        "current": {"time": 1781505000, "temperature_2m": 30, "weather_code": 2},
        "hourly": {
            "time": [1781505000, 1781508600],
            "temperature_2m": [30, 31],
            "uv_index": [4, float("nan")],
        },
        "daily": {
            "time": [1781481600],
            "temperature_2m_max": [33],
            "temperature_2m_min": [25],
            "sunrise": [],
            "sunset": [],
        },
    }

    async def request(*args):
        return fixture

    monkeypatch.setattr("app.providers.open_meteo.request", request)
    result = await OpenMeteoWeather().fetch(Location())
    assert result.status == "estimated"
    assert result.current.metrics["temperature"].value == 30
    assert result.current.metrics["temperature"].valid_at.timestamp() == 1781505000
    assert result.current.metrics["humidity"].status == "unavailable"
    assert result.hourly[1].metrics["uv"].value is None
    assert result.daily[0].sunrise is None


@pytest.mark.asyncio
async def test_malformed_weather_raises_to_fallback(monkeypatch):
    async def request(*args):
        return {"current": {}}

    monkeypatch.setattr("app.providers.open_meteo.request", request)
    with pytest.raises(KeyError):
        await OpenMeteoWeather().fetch(Location())


@pytest.mark.asyncio
async def test_air_missing_particles_are_unavailable(monkeypatch):
    async def request(*args):
        return {"current": {"time": 1781505000, "us_aqi": 120}}

    monkeypatch.setattr("app.providers.open_meteo.request", request)
    result = await OpenMeteoAir().fetch(Location())
    assert result["aqi"].unit == "US AQI"
    assert result["pm25"].value is None and result["pm25"].status == "unavailable"


@pytest.mark.asyncio
async def test_inland_marine_is_rejected(monkeypatch):
    async def request(*args):
        return {
            "latitude": 15,
            "longitude": 73,
            "current": {"time": 1781505000, "wave_height": 1.5},
        }

    monkeypatch.setattr("app.providers.open_meteo.request", request)
    with pytest.raises(ValueError):
        await OpenMeteoMarine().fetch(Location())
