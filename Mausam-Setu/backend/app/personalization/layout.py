"""Order actual dashboard sections; safety priority never uses preference weights."""

from datetime import timedelta

from app.core.config import settings

# These are section affinities, not hazard thresholds.
AFFINITIES = {
    "student": {"plans": 97, "insights": 95, "community": 80, "forecast": 83},
    "hill": {"insights": 96, "community": 88, "environment": 90, "plans": 85},
    "health": {"environment": 88, "insights": 83, "overview": 50},
    "fitness": {"plans": 92, "insights": 88, "environment": 80, "forecast": 65},
    "agriculture": {"insights": 95, "soil": 92, "plans": 88, "forecast": 75},
    "travel": {"plans": 96, "insights": 90, "forecast": 82, "places": 78},
    "family": {"plans": 95, "insights": 85, "environment": 77, "forecast": 70},
    "commute": {"insights": 94, "plans": 90, "environment": 82, "map": 65},
    "marine": {"marine": 95, "plans": 91, "insights": 88, "map": 70},
    "events": {"plans": 95, "forecast": 88, "insights": 84, "environment": 65},
}
TITLES = {
    "community": "Conditions around you",
    "saved_plans": "Weather-aware plans",
    "controls": "Privacy and notifications",
    "risk": "Weather risk",
    "safety": "Safety first",
    "overview": "Current weather",
    "insights": "Today, for you",
    "plans": "Your plans",
    "soil": "Soil moisture",
    "marine": "Marine conditions",
    "forecast": "Forecast",
    "environment": "Around you",
    "map": "Weather map",
    "places": "Your places",
}


def build_layout(bundle, profile, risk, safety, recommendations):
    priorities = {
        "community": 48,
        "saved_plans": 46,
        "controls": 5,
        "risk": 60,
        "overview": 45,
        "insights": 30,
        "plans": 25,
        "forecast": 40,
        "environment": 35,
        "map": 20,
        "places": 15,
    }
    reasons = {key: ["General weather context"] for key in priorities}
    for persona in profile.interests:
        weight = max(
            0,
            min(
                2,
                profile.preference_weights.get(persona, 1)
                + profile.learned_weights.get(persona, 1)
                - 1,
            ),
        )
        for key, affinity in AFFINITIES[persona].items():
            priorities[key] = max(priorities.get(key, 0), affinity * (0.8 + 0.2 * weight))
            reasons.setdefault(key, []).append(f"Selected interest: {persona}; weight {weight:g}")
    if profile.activity in AFFINITIES:
        for key in AFFINITIES[profile.activity]:
            priorities[key] = priorities.get(key, 0) + 5
            reasons.setdefault(key, []).append("Matches today's activity")
    if profile.planning.sensitivities:
        priorities["environment"] += 8
        reasons["environment"].append("Exposure sensitivity preferences")
    if profile.planning.event_date or profile.planning.crop != "none":
        priorities["plans"] += 4
        reasons["plans"].append("Configured event or planting plan")
    if recommendations:
        priorities["insights"] += max(r.priority for r in recommendations) / 20
        reasons["insights"].append("Time, weather and freshness relevance")
    if risk["score"] is not None and risk["score"] >= 50:
        priorities["risk"] = 150
        reasons["risk"].append("Elevated weather screening index")
    if safety["emergency"] or safety["official_warnings"]:
        priorities["safety"] = 1000
        reasons["safety"] = ["Safety override; user preferences cannot hide this section"]
    expiry = min(
        bundle.reference_time + timedelta(hours=1),
        bundle.retrieved_at + timedelta(seconds=settings.cache_max_seconds),
    )
    return [
        {
            "widget_id": key,
            "widget_type": key,
            "priority": round(priority, 2),
            "title": TITLES[key],
            "subtitle": bundle.location.name,
            "data": {"section": key},
            "reason": reasons.get(key, []),
            "severity": "critical" if key == "safety" and safety["emergency"] else "info",
            "source": bundle.source,
            "status": bundle.status,
            "last_updated": bundle.retrieved_at,
            "expires_at": expiry,
            "actions": ["explain"],
        }
        for key, priority in sorted(priorities.items(), key=lambda item: (-item[1], item[0]))
    ]
