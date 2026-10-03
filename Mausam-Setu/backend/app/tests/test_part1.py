from datetime import timedelta

import pytest
from pydantic import ValidationError

from app.personalization.engine import compose
from app.providers.demo import fixture
from app.providers.india import ADAPTERS
from app.safety.engine import evaluate
from app.schemas.weather import Location, OfficialWarning, Profile


def test_layout_switches_structure_and_keeps_all_baseline_sections():
    bundle = fixture(Location())
    layouts = {}
    for interest in [
        "fitness",
        "agriculture",
        "travel",
        "family",
        "health",
        "marine",
        "commute",
        "events",
    ]:
        home = compose(bundle, Profile(interests=[interest]))
        layouts[interest] = [w["widget_id"] for w in home.homepage_layout]
        assert {"overview", "forecast", "insights", "plans", "map", "environment", "risk"} <= set(
            layouts[interest]
        )
        for widget in home.homepage_layout:
            assert {"reason", "expires_at", "status", "actions", "priority"} <= widget.keys()
    assert layouts["health"] != layouts["agriculture"] != layouts["fitness"]
    assert layouts["marine"][0] == "marine"


def test_critical_safety_survives_zero_interest_weights():
    home = compose(
        fixture(Location(), "storm"),
        Profile(interests=["fitness"], preference_weights={"fitness": 0}),
    )
    assert home.safety["emergency"]
    assert home.homepage_layout[0]["widget_id"] == "safety"
    assert any(h["code"] == "thunderstorm" for h in home.safety["hazards"])
    assert home.weather_risk["score"] != home.personalized_sections[0].priority


@pytest.mark.parametrize(
    "scenario", ["pleasant", "heat", "rain", "air", "fog", "storm", "coast", "frost"]
)
def test_risk_has_bounded_explainable_contributions(scenario):
    risk, _ = evaluate(fixture(Location(), scenario))
    assert 0 <= risk["score"] <= 100
    assert risk["score"] == round(min(100, sum(c["points"] for c in risk["components"])))
    assert all(0 <= c["points"] <= c["maximum"] for c in risk["components"])


def test_missing_is_not_zero_and_expired_cannot_trigger_emergency():
    bundle = fixture(Location(), "missing")
    assert evaluate(bundle)[0]["score"] is None
    bundle = fixture(Location(), "storm")
    bundle.reference_time += timedelta(days=1)
    risk, safety = evaluate(bundle)
    assert risk["score"] is None and not safety["emergency"]


def test_partial_input_and_critical_boundary():
    bundle = fixture(Location())
    bundle.air_quality.clear()
    bundle.current.metrics["wind"].value = 70
    risk, safety = evaluate(bundle)
    assert "aqi" in risk["missing"] and risk["coverage"] == "partial"
    assert any(h["code"] == "wind" for h in safety["hazards"])
    bundle.current.metrics["wind"].value = 69.9
    assert not evaluate(bundle)[1]["emergency"]


def test_expired_metric_cannot_be_scored_even_in_fresh_bundle():
    bundle = fixture(Location())
    bundle.air_quality["aqi"].value = 500
    bundle.air_quality["aqi"].expires_at = bundle.reference_time - timedelta(seconds=1)
    risk, safety = evaluate(bundle)
    assert "aqi" in risk["missing"] and not safety["emergency"]


def test_wrong_location_and_expired_official_warning_are_ignored():
    bundle = fixture(Location())
    warning = OfficialWarning(
        id="test",
        authority="IMD",
        title="Fixture",
        message="Fixture",
        severity="severe",
        location=bundle.location,
        issued_at=bundle.reference_time,
        start_time=bundle.reference_time,
        end_time=bundle.reference_time + timedelta(hours=1),
        source_url="https://mausam.imd.gov.in/",
        status="simulated",
    )
    bundle.official_warnings = [warning]
    assert compose(bundle, Profile()).homepage_layout[0]["widget_id"] == "safety"
    warning.location = Location(name="Other", latitude=1, longitude=1)
    assert not evaluate(bundle)[1]["emergency"]
    warning.location = bundle.location
    warning.end_time = bundle.reference_time
    assert not evaluate(bundle)[1]["emergency"]


def test_metric_provenance_and_rule_trace():
    home = compose(fixture(Location()), Profile())
    assert all(m.expires_at and m.quality == "low" for m in home.current_weather.metrics.values())
    rule = home.personalized_sections[0].rule_metadata
    assert rule["inputs"] and rule["screening_thresholds"] and rule["version"]


def test_preference_validation():
    with pytest.raises(ValidationError):
        Profile(preference_weights={"fitness": 3})


@pytest.mark.asyncio
async def test_official_adapters_are_explicitly_unconfigured():
    for adapter in ADAPTERS:
        result = await adapter.fetch(Location())
        assert result.status == "unavailable" and not result.metrics and not result.warnings


def test_official_adapter_rejects_mismatched_origin():
    with pytest.raises(ValueError):
        ADAPTERS[0].accept({"authority": "NDMA", "location": Location().model_dump()}, Location())
