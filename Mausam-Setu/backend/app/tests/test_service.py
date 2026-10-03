from datetime import timedelta

import pytest

from app.core.config import settings
from app.providers.demo import fixture
from app.schemas.weather import Location, now
from app.services.weather import WeatherService, cache_key


class Fail:
    async def fetch(self, loc):
        raise TimeoutError("test provider down")


class Good:
    calls = 0

    async def fetch(self, loc):
        self.calls += 1
        b = fixture(loc, "pleasant")
        b.retrieved_at = now()
        b.reference_time = now()
        b.status = "estimated"
        for p in [b.current, *b.hourly]:
            for m in p.metrics.values():
                m.status = "estimated"
        return b


@pytest.fixture
def cache_store(monkeypatch):
    store = {}
    monkeypatch.setattr("app.services.weather.get_snapshot", lambda k: store.get(k))
    monkeypatch.setattr("app.services.weather.put_snapshot", lambda k, v: store.update({k: v}))
    return store


@pytest.mark.asyncio
async def test_provider_fallback_and_optional_failure(cache_store):
    good = Good()
    s = WeatherService([Fail(), good], Fail(), Fail(), Fail())
    b = await s.get(Location())
    assert b.status == "estimated" and not b.air_quality and good.calls == 1
    second = await s.get(Location())
    assert second.status == "cached" and good.calls == 1
    assert all(m.status == "cached" for m in second.current.metrics.values())


@pytest.mark.asyncio
async def test_outage_never_silently_uses_demo(cache_store, monkeypatch):
    s = WeatherService([Fail()], Fail(), Fail(), Fail())
    assert (await s.get(Location())).status == "unavailable"
    monkeypatch.setattr(settings, "demo_fallback", False)
    assert (await s.get(Location())).status == "unavailable"


@pytest.mark.asyncio
async def test_stale_cache_and_expired_cache(cache_store, monkeypatch):
    loc = Location()
    b = fixture(loc)
    b.retrieved_at = now() - timedelta(hours=1)
    b.status = "estimated"
    key = cache_key(loc, False)
    cache_store[key] = b.model_dump(mode="json")
    s = WeatherService([Fail()], Fail(), Fail(), Fail())
    assert (await s.get(loc)).status == "cached"
    b.retrieved_at = now() - timedelta(hours=4)
    cache_store[key] = b.model_dump(mode="json")
    assert (await s.get(loc)).status == "unavailable"


@pytest.mark.asyncio
async def test_concurrent_deduplication(cache_store):
    import asyncio

    good = Good()
    s = WeatherService([good], Fail(), Fail(), Fail())
    await asyncio.gather(*[s.get(Location()) for _ in range(5)])
    assert good.calls == 1
