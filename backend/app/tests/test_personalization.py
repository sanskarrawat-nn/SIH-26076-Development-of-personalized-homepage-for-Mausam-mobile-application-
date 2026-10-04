from datetime import timedelta

import pytest

from app.personalization.engine import compose
from app.providers.demo import SCENARIOS, fixture
from app.schemas.weather import Location, Profile
from app.utils.calculations import activity_window, total_rain


@pytest.mark.parametrize(
    "scenario,persona,needle",
    [
        ("heat_no_window", "fitness", "caution"),
        ("travel_rain", "travel", "umbrella"),
        ("rain", "family", "rain protection"),
        ("agriculture_rain", "agriculture", "18 mm"),
        ("fog", "commute", "visibility"),
        ("air", "health", "air quality"),
        ("pleasant", "marine", "unavailable"),
        ("pleasant", "events", "comfort"),
    ],
)
def test_persona_matrix(scenario, persona, needle):
    home = compose(fixture(Location(), scenario), Profile(interests=[persona]))
    assert (
        needle
        in (
            home.personalized_sections[0].title + " " + home.personalized_sections[0].message
        ).lower()
    )
    assert home.data_status["status"] == "simulated"


@pytest.mark.parametrize("scenario", SCENARIOS)
def test_no_fake_data_and_bounded_scores(scenario):
    home = compose(
        fixture(Location(), scenario),
        Profile(
            interests=[
                "health",
                "fitness",
                "travel",
                "family",
                "agriculture",
                "commute",
                "marine",
                "events",
            ]
        ),
    )
    assert all(0 <= x.priority <= 100 for x in home.personalized_sections)
    assert all(x.expires_at > x.timestamp for x in home.personalized_sections)
    if scenario == "coast":
        assert home.marine and all(m.status == "simulated" for m in home.marine.values())
    else:
        assert not home.marine
    assert home.data_status["traffic"] == "unavailable"
    assert len({x.id for x in home.personalized_sections}) == len(home.personalized_sections)
    assert len(home.today_for_you) <= 3


def test_multi_interest_deduplication():
    home = compose(fixture(Location(), "heat"), Profile(interests=["fitness", "health", "fitness"]))
    assert len(home.personalized_sections) == 1
    assert set(home.personalized_sections[0].personas) == {"fitness", "health"}
    assert "heat" in [a.type for a in home.priority_alerts]


def test_missing_no_advice():
    home = compose(fixture(Location(), "missing"), Profile())
    assert home.personalized_sections == [] and home.priority_alerts == []


def test_all_null_metrics_do_not_crash():
    b = fixture(Location(), "pleasant")
    for m in b.current.metrics.values():
        m.value = None
        m.status = "unavailable"
    b.air_quality = {}
    result = compose(b, Profile(interests=["health"]))
    assert result.personalized_sections[0].quality == "unavailable"


def test_expired_suppresses_advice():
    b = fixture(Location(), "heat")
    b.reference_time += timedelta(hours=4)
    home = compose(b, Profile())
    assert home.personalized_sections == [] and home.priority_alerts == []
    assert home.data_status["freshness"] == "expired"


def test_rank_changes_with_activity():
    b = fixture(Location(), "pleasant")
    general = compose(b, Profile(interests=["health", "travel"]))
    travel = compose(b, Profile(interests=["health", "travel"], activity="travel"))
    before = next(x for x in general.personalized_sections if x.id == "packing")
    after = next(x for x in travel.personalized_sections if x.id == "packing")
    assert after.priority > before.priority


def test_window_checks_daylight_complete_hours_and_air():
    b = fixture(Location(), "pleasant")
    w = activity_window(b)
    assert w and w[2] - w[1] == timedelta(hours=2)
    assert any(w[1] >= d.sunrise and w[2] <= d.sunset for d in b.daily)
    b.air_quality["aqi"].value = 180
    assert activity_window(b) is None
    b.air_quality["aqi"].value = 50
    for p in b.hourly:
        p.metrics.pop("uv", None)
    assert activity_window(b) is None


def test_rain_completeness():
    b = fixture(Location(), "agriculture_rain")
    assert total_rain(b.hourly[:24]) == 18
    b.hourly[4].metrics["precipitation"].value = None
    assert total_rain(b.hourly[:24]) is None
