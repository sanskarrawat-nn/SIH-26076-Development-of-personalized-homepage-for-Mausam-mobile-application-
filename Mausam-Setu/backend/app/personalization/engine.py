"""Combine persona advice, calculate priorities and build the homepage response."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.alerts.engine import generate_alerts
from app.core.config import POLICIES, settings
from app.personalization.layout import build_layout
from app.providers.india import provider_status
from app.recommendations.planning import build_planning
from app.recommendations.policies import RULES
from app.safety.engine import evaluate
from app.schemas.weather import Home, Profile, Recommendation, WeatherBundle
from app.utils.calculations import value


def merge_insight(existing: dict, incoming: dict, persona: str) -> None:
    existing["personas"].append(persona)
    existing["reasons"].extend(incoming["reasons"])
    existing["message"] += " " + incoming["message"]
    existing["metrics"] = list(dict.fromkeys(existing["metrics"] + incoming.get("metrics", [])))
    existing["risk"] = max(existing["risk"], incoming["risk"])
    if incoming.get("window_start"):
        for field in ("title", "window_start", "window_end"):
            existing[field] = incoming[field]


def grouped_insights(bundle: WeatherBundle, profile: Profile) -> list[dict]:
    groups = {}
    for persona in profile.interests:
        for rule_name in POLICIES["personas"][persona]["rules"]:
            insight = RULES[rule_name](bundle, profile)
            group_name = insight.get("group", rule_name)
            if group_name in groups:
                merge_insight(groups[group_name], insight, persona)
                continue
            insight.update(id=group_name, personas=[persona])
            insight.setdefault("metrics", [])
            groups[group_name] = insight
    return list(groups.values())


def score_components(insight: dict, bundle: WeatherBundle, profile: Profile, age: float) -> dict:
    local_hour = bundle.reference_time.astimezone(ZoneInfo(bundle.location.timezone)).hour
    is_journey = any(persona in ("family", "commute") for persona in insight["personas"])
    is_commute_period = 6 <= local_hour <= 9 or 15 <= local_hour <= 19
    concern = min(1, max(0, insight["risk"]))
    relevance = {
        "interest": min(
            1,
            max((profile.preference_weights.get(p, 1) for p in insight["personas"]), default=1) / 2
            + 0.5,
        ),
        "weather": concern,
        "time": 1 if is_journey and is_commute_period else 0.5,
        "severity": concern,
        "location": 1,
        "activity": 1 if profile.activity in insight["personas"] else 0.3,
        "freshness": max(0, 1 - age / settings.cache_max_seconds),
    }
    return {
        component: round(fraction * POLICIES["weights"][component], 2)
        for component, fraction in relevance.items()
    }


def recommendation(
    insight: dict, bundle: WeatherBundle, profile: Profile, age: float
) -> Recommendation:
    scores = score_components(insight, bundle, profile, age)
    metrics = {**bundle.current.metrics, **bundle.air_quality, **bundle.marine}
    available = sum(value(metrics, name) is not None for name in insight["metrics"])
    if available == 0:
        quality = "unavailable"
    elif bundle.status in ("cached", "simulated") or available < len(insight["metrics"]):
        quality = "low"
    else:
        quality = "medium"

    reasons = list(dict.fromkeys(insight["reasons"]))
    reasons.append("Selected interests: " + ", ".join(insight["personas"]) + ".")
    priority = min(100, 100 * sum(scores.values()) / sum(POLICIES["weights"].values()))
    learned = (
        max((profile.learned_weights.get(p, 1) - 1 for p in insight["personas"]), default=0) * 5
    )
    priority = max(0, min(100, priority + learned))
    scores["learned_preference"] = round(learned, 2)
    if learned:
        reasons.append(
            "Device feedback and time-of-day habits adjusted relevance by "
            + str(round(learned, 2))
            + "; safety is unchanged."
        )
    return Recommendation(
        id=insight["id"],
        type=insight["id"],
        title=insight["title"],
        message=insight["message"],
        priority=round(priority, 1),
        timestamp=bundle.reference_time,
        expires_at=bundle.reference_time + timedelta(hours=1),
        source=bundle.source,
        status=bundle.status,
        quality=quality,
        reasons=reasons,
        personas=insight["personas"],
        score_breakdown=scores,
        metrics=insight["metrics"],
        message_code=insight["id"].upper(),
        rule_metadata={
            "rule_id": insight["id"],
            "version": "2.1",
            "inputs": {
                name: metrics[name].model_dump(mode="json")
                for name in insight["metrics"]
                if name in metrics
            },
            "screening_thresholds": POLICIES["thresholds"],
            "reference": "Project screening policies; not official thresholds or a trained ML model",
            "severity": "caution" if insight["risk"] >= 0.5 else "info",
            "activity": profile.activity,
            "location": bundle.location.name,
            "planning": profile.planning.model_dump(mode="json"),
            "preference_weights": {
                p: profile.preference_weights.get(p, 1) for p in insight["personas"]
            },
            "learned_weights": profile.learned_weights,
            "freshness_seconds": age,
        },
        window_start=insight.get("window_start"),
        window_end=insight.get("window_end"),
    )


def compose(bundle: WeatherBundle, profile: Profile) -> Home:
    age = max(0, (bundle.reference_time - bundle.retrieved_at).total_seconds())
    can_advise = bundle.status != "unavailable" and age <= settings.cache_max_seconds
    recommendations = []
    if can_advise:
        recommendations = [
            recommendation(insight, bundle, profile, age)
            for insight in grouped_insights(bundle, profile)
        ]
    recommendations.sort(key=lambda item: (-item.priority, item.id))

    if age <= settings.cache_fresh_seconds:
        freshness = "fresh"
    elif age <= settings.cache_max_seconds:
        freshness = "stale"
    else:
        freshness = "expired"
    pollen_available = any(
        value(bundle.air_quality, name) is not None
        for name in ("grass_pollen", "birch_pollen", "alder_pollen")
    )
    risk, safety = evaluate(bundle)
    return Home(
        weather_risk=risk,
        safety=safety,
        homepage_layout=build_layout(bundle, profile, risk, safety, recommendations),
        provider_status=provider_status(),
        configured_contacts=[
            c.model_dump(mode="json")
            for c in settings.emergency_contacts
            if timedelta(0) <= datetime.now(timezone.utc) - c.checked_at <= timedelta(days=365)
        ],
        location=bundle.location,
        current_weather=bundle.current,
        today_for_you=recommendations[:3],
        personalized_sections=recommendations,
        priority_alerts=generate_alerts(bundle) if can_advise else [],
        hourly=bundle.hourly,
        daily=bundle.daily,
        air_quality=bundle.air_quality,
        marine=bundle.marine,
        data_status={
            "status": bundle.status,
            "source": bundle.source,
            "retrieved_at": bundle.retrieved_at,
            "age_seconds": int(age),
            "freshness": freshness,
            "notices": bundle.notices,
            "scenario": bundle.scenario,
            "official_alerts": "available" if safety["official_warnings"] else "unavailable",
            "traffic": "unavailable",
            "pollen": "available" if pollen_available else "unavailable",
            "soil_moisture": "available"
            if value(bundle.current.metrics, "soil_moisture") is not None
            else "unavailable",
            "tides": "unavailable",
        },
        generated_at=bundle.reference_time,
        reference_time=bundle.reference_time,
        planning=build_planning(bundle, profile) if can_advise else {},
    )
