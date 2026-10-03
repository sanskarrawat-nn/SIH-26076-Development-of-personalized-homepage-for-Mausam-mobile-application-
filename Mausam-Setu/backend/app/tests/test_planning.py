from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app, requests
from app.personalization.engine import compose
from app.providers import extras
from app.providers.demo import fixture
from app.recommendations.planning import assessment, event, fitness, planting, school
from app.schemas.weather import Location, Planning, Profile


def test_event_full_duration_and_missing_hour():
    b = fixture(Location(), "pleasant")
    opts = Planning(event_date=date(2026, 6, 15), event_start="17:30", event_hours=3)
    assert event(b, opts)["available"]
    b.hourly = [p for p in b.hourly if p.time.hour != 19]
    result = event(b, opts)
    assert not result["available"] and "comfort" not in result


@pytest.mark.parametrize("day", [date(2026, 6, 14), date(2026, 7, 1)])
def test_event_past_and_beyond_forecast(day):
    assert not event(fixture(Location()), Planning(event_date=day))["available"]


def test_school_times_change_sampled_forecast():
    b = fixture(Location(), "rain")
    a = school(b, Planning(school_dropoff="08:00"))
    c = school(b, Planning(school_dropoff="11:00"))
    assert a[0]["rain_probability"] == 35 and c[0]["rain_probability"] == 90
    assert a[0]["start"].hour == 8 and c[0]["start"].hour == 11


def test_fitness_duration_and_preferences():
    b = fixture(Location())
    result = fitness(b, Planning(duration_minutes=90, preferred_start=10, preferred_end=14))
    assert result["available"] and result["end"] - result["start"] == timedelta(minutes=90)
    assert result["start"].hour >= 10 and result["end"].hour <= 14
    assert not fitness(b, Planning(preferred_start=23, preferred_end=24))["available"]


def test_intensity_is_used():
    b = fixture(Location())
    for p in b.hourly:
        p.metrics["feels_like"].value = 29
    assert fitness(b, Planning(intensity="light"))["available"]
    assert not fitness(b, Planning(intensity="vigorous"))["available"]


def test_comfort_not_rain_safety_score():
    b = fixture(Location())
    p = b.hourly[4]
    a = assessment([p])
    p.metrics["rain_probability"].value = 100
    c = assessment([p])
    assert a["comfort"] == c["comfort"] and "Rain" in c["concerns"]
    p.metrics["feels_like"].value = 50
    assert assessment([p])["comfort"] < a["comfort"]


def test_advance_frost_and_storm():
    b = fixture(Location(), "frost")
    h = compose(b, Profile())
    assert b.current.metrics["temperature"].value > 0
    assert any(
        x.type == "forecast-frost" and x.start_time > b.reference_time for x in h.priority_alerts
    )
    assert any(
        x.type == "forecast-storm"
        for x in compose(fixture(Location(), "storm"), Profile()).priority_alerts
    )


def test_sensitivity_and_no_india_pollen_claim():
    b = fixture(Location(), "pleasant")
    b.air_quality["aqi"].value = 85
    h = compose(
        b, Profile(interests=["health"], planning=Planning(sensitivities=["air", "pollen"]))
    )
    msg = h.personalized_sections[0].message
    assert "earlier caution" in msg and "unavailable" in msg


def test_planting_source_region_and_date():
    b = fixture(Location())
    assert not planting(b, Planning(crop="tomato"))["available"]
    p = planting(
        b, Planning(crop="tomato", growing_region="south_india", planting_date=date(2026, 10, 1))
    )
    assert p["in_season"] and p["source"].startswith("https://agritech.tnau.ac.in/")
    assert not planting(
        b, Planning(crop="tomato", growing_region="south_india", planting_date=date(2026, 9, 1))
    )["in_season"]


def test_expired_or_missing_plans_suppressed():
    b = fixture(Location())
    b.reference_time += timedelta(hours=4)
    assert compose(b, Profile(interests=["events", "fitness"])).planning == {}
    assert compose(fixture(Location(), "missing"), Profile(interests=["events"])).planning == {}


@pytest.fixture
def client():
    requests.clear()
    with TestClient(app) as c:
        yield c


def body():
    return {
        "origin": Location().model_dump(),
        "destination": Location(name="Delhi", latitude=28.6, longitude=77.2).model_dump(),
        "departure": "2026-06-15T08:00",
        "arrival": "2026-06-15T10:00",
        "mode": "demo",
        "scenario": "rain",
    }


def test_journey_demo_and_time_validation(client):
    r = client.post("/api/planner/journey", json=body())
    assert r.status_code == 200
    assert all(x["status"] == "simulated" for x in r.json()["endpoints"])
    assert r.json()["traffic"]["status"] == "simulated"
    bad = body()
    bad["arrival"] = "2026-06-15T06:00"
    assert client.post("/api/planner/journey", json=bad).status_code == 422


def test_journey_timezones(client):
    b = body()
    b["destination"]["timezone"] = "Europe/London"
    b["arrival"] = "2026-06-15T06:00"
    # 06:00 BST is after 08:00 IST.
    assert client.post("/api/planner/journey", json=b).status_code == 200


def test_tides_demo_and_not_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "worldtides_api_key", "")
    b = {"location": Location().model_dump(), "day": "2026-06-15", "mode": "demo"}
    r = client.post("/api/planner/tides", json=b).json()
    assert r["status"] == "simulated" and len(r["events"]) == 4
    b["mode"] = "live"
    assert client.post("/api/planner/tides", json=b).json()["status"] == "unavailable"


@pytest.mark.asyncio
async def test_traffic_adapter(monkeypatch):
    extras._cache.clear()
    monkeypatch.setattr(settings, "tomtom_api_key", "test-only")

    async def request(url, params):
        assert params["traffic"] == "true" and "calculateRoute" in url
        return {
            "routes": [
                {
                    "summary": {
                        "travelTimeInSeconds": 1800,
                        "trafficDelayInSeconds": 300,
                        "lengthInMeters": 12300,
                    }
                }
            ]
        }

    monkeypatch.setattr(extras, "request", request)
    r = await extras.traffic(
        Location(), Location(latitude=27), datetime.now(timezone.utc) + timedelta(hours=1), "live"
    )
    assert r["minutes"] == 30 and r["delay_minutes"] == 5 and r["status"] == "estimated"


@pytest.mark.asyncio
async def test_tide_location_guard(monkeypatch):
    extras._cache.clear()
    monkeypatch.setattr(settings, "worldtides_api_key", "test-only")

    async def request(*args):
        return {"status": 200, "responseLat": 0, "responseLon": 0, "extremes": []}

    monkeypatch.setattr(extras, "request", request)
    assert (await extras.tides(Location(), date(2026, 9, 25), "live"))["status"] == "unavailable"


@pytest.mark.asyncio
async def test_airport_stale_and_wrong_location(monkeypatch):
    extras._cache.clear()

    async def request(url, params):
        return (
            [{"icaoId": "VILK", "lat": 26.8, "lon": 80.9, "obsTime": 1, "rawOb": "Old report"}]
            if "metar" in url
            else []
        )

    monkeypatch.setattr(extras, "request", request)
    r = await extras.aviation("VILK", Location(), datetime.now(timezone.utc), "live")
    assert r["status"] == "unavailable"


def test_invalid_planning_json_and_limits(client):
    for planning in ["bad", "[]", '{"event_hours":24}', '{"duration_minutes":-1}']:
        assert (
            client.get(
                "/api/home/personalized", params={"mode": "demo", "planning": planning}
            ).status_code
            == 422
        )


def test_post_cors(client):
    r = client.options(
        "/api/planner/journey",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_tides_preserve_datum_and_attribution(monkeypatch):
    monkeypatch.setattr(settings, "worldtides_api_key", "test-only")

    async def request(url, params):
        return {
            "status": 200,
            "responseLat": 26.85,
            "responseLon": 80.95,
            "responseDatum": "MSL",
            "copyright": "Provider attribution",
            "extremes": [{"dt": 1781500000, "height": 1.2, "type": "High"}],
        }

    monkeypatch.setattr(extras, "request", request)
    r = await extras.tides(Location(), date(2026, 6, 15), "live")
    assert (
        r["status"] == "estimated"
        and r["datum"] == "MSL"
        and r["message"] == "Provider attribution"
    )


@pytest.mark.asyncio
async def test_taf_validity_and_station_location(monkeypatch):
    extras._cache.clear()
    at = datetime.now(timezone.utc)

    async def request(url, params):
        return (
            []
            if "metar" in url
            else [
                {
                    "icaoId": "VILK",
                    "lat": 26.8,
                    "lon": 80.9,
                    "validTimeFrom": int((at - timedelta(hours=1)).timestamp()),
                    "validTimeTo": int((at + timedelta(hours=2)).timestamp()),
                    "rawTAF": "TAF test forecast",
                }
            ]
        )

    monkeypatch.setattr(extras, "request", request)
    r = await extras.aviation("VILK", Location(), at, "live")
    assert r["status"] == "estimated" and r["reports"][0]["type"] == "TAF"
    assert (await extras.aviation("VILK", Location(), at + timedelta(days=1), "live"))[
        "status"
    ] == "unavailable"
    assert (await extras.aviation("VILK", Location(latitude=0, longitude=0), at, "live"))[
        "status"
    ] == "unavailable"


@pytest.mark.asyncio
async def test_optional_pollen_failure_preserves_aqi(monkeypatch):
    from app.providers import open_meteo

    async def request(url, params):
        if "domains" in params:
            raise TimeoutError()
        return {"current": {"time": 1781500000, "us_aqi": 50, "pm2_5": 10, "pm10": 15}}

    monkeypatch.setattr(open_meteo, "request", request)
    r = await open_meteo.OpenMeteoAir().fetch(Location(latitude=52.5, longitude=13.4))
    assert r["aqi"].value == 50 and "grass_pollen" not in r


@pytest.mark.asyncio
async def test_soil_depth_normalization(monkeypatch):
    from app.providers import open_meteo

    async def request(url, params):
        return {
            "hourly": {
                "time": [1781500000],
                "soil_moisture_0_to_1cm": [0.2],
                "soil_moisture_3_to_9cm": [0.3],
            }
        }

    monkeypatch.setattr(open_meteo, "request", request)
    r = await open_meteo.OpenMeteoSoil().fetch(Location())
    assert r["soil_moisture"].value == 0.2 and r["soil_moisture_root"].value == 0.3
    assert r["soil_moisture"].unit == "m³/m³" and r["soil_moisture"].status == "estimated"


def test_supported_planting_calendar_boundaries():
    b = fixture(Location())
    for day, inside in [(4, False), (5, True), (25, True), (26, False)]:
        result = planting(
            b,
            Planning(
                crop="wheat_hd3226",
                growing_region="north_western_plains",
                planting_date=date(2026, 11, day),
            ),
        )
        assert result["in_season"] == inside
    assert planting(
        b, Planning(crop="okra", growing_region="tamil_nadu", planting_date=date(2026, 2, 1))
    )["in_season"]


def test_invalid_preferred_hours(client):
    assert (
        client.get(
            "/api/home/personalized",
            params={"mode": "demo", "planning": '{"preferred_start":20,"preferred_end":8}'},
        ).status_code
        == 422
    )


def test_heat_demo_window_and_separate_refusal():
    warm = fixture(Location(), "heat")
    result = fitness(warm, Planning())
    assert warm.reference_time.hour == 12
    assert warm.current.metrics["temperature"].value == 38
    assert warm.current.metrics["uv"].value == 9
    assert result["available"] and 5 <= result["start"].hour <= 7
    assert not fitness(fixture(Location(), "heat_no_window"), Planning())["available"]
    assert fixture(Location(), "heat").model_dump() == warm.model_dump()
