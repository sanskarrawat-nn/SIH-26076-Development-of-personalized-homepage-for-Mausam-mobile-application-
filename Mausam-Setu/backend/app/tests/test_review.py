import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.schemas.weather import Location
from app.services.weather import WeatherService, cache_key
from app.tests.test_service import Fail, Good
from app.utils.time import add_hours, resolve_local_time


@pytest.mark.parametrize("clock", ["2026-03-08T02:30", "2026-11-01T01:30"])
def test_reject_ambiguous_or_missing_local_clock(clock):
    with pytest.raises(ValueError):
        resolve_local_time(datetime.fromisoformat(clock), "America/New_York")


def test_elapsed_duration_crosses_clock_change():
    start = datetime(2026, 3, 8, 1, 30, tzinfo=ZoneInfo("America/New_York"))
    assert add_hours(start, 1).hour == 3
    explicit = datetime.fromisoformat("2026-11-01T01:30-05:00")
    assert resolve_local_time(explicit, "America/New_York") == explicit


def test_cache_keys_preserve_nearby_locations_and_timezone():
    original = Location()
    nearby = original.model_copy(update={"latitude": original.latitude + 0.0001})
    other_zone = original.model_copy(update={"timezone": "UTC"})
    assert len({cache_key(loc, False) for loc in [original, nearby, other_zone]}) == 3


@pytest.mark.asyncio
async def test_cache_failure_still_returns_weather(monkeypatch):
    def fail(*args):
        raise OSError("disk unavailable")

    monkeypatch.setattr("app.services.weather.get_snapshot", fail)
    monkeypatch.setattr("app.services.weather.put_snapshot", fail)
    service = WeatherService([Good()], Fail(), Fail(), Fail())
    assert (await service.get(Location())).status == "estimated"


@pytest.mark.asyncio
async def test_cancelled_client_does_not_cancel_shared_weather(monkeypatch):
    monkeypatch.setattr("app.services.weather.get_snapshot", lambda key: None)
    monkeypatch.setattr("app.services.weather.put_snapshot", lambda *args: None)
    entered, release = asyncio.Event(), asyncio.Event()

    class Slow(Good):
        async def fetch(self, loc):
            entered.set()
            await release.wait()
            return await super().fetch(loc)

    provider = Slow()
    service = WeatherService([provider], Fail(), Fail(), Fail())
    first = asyncio.create_task(service.get(Location()))
    await entered.wait()
    second = asyncio.create_task(service.get(Location()))
    await asyncio.sleep(0)
    first.cancel()
    with pytest.raises(asyncio.CancelledError):
        await first
    release.set()
    assert (await second).status == "estimated"
    assert provider.calls == 1
