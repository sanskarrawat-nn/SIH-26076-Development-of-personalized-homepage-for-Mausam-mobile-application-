"""Explainable prototype index. This is neither an official index nor a probability.

Each component uses its worst available input in the next six hours. Missing
inputs remain visible. A single critical trigger overrides personalized order,
regardless of the aggregate score. Source expiry gates every numeric input.
"""

from datetime import timedelta

from app.core.config import POLICIES, settings


def valid_metric(metric, reference):
    return (
        metric is not None
        and metric.value is not None
        and metric.status not in ("unavailable", "community_unverified", "community_verified")
        and metric.retrieved_at <= reference
        and metric.expires_at is not None
        and reference < metric.expires_at
    )


def applicable_warnings(bundle):
    result = []
    for warning in bundle.official_warnings:
        # The adapter must resolve the provider's district/polygon to this exact
        # requested location. A similarly named place is not enough.
        same_place = (
            abs(warning.location.latitude - bundle.location.latitude) < 0.00001
            and abs(warning.location.longitude - bundle.location.longitude) < 0.00001
        )
        demo_matches = (warning.status == "simulated") == (bundle.status == "simulated")
        if (
            same_place
            and demo_matches
            and warning.issued_at <= bundle.reference_time
            and warning.end_time > bundle.reference_time
            and warning.start_time <= bundle.reference_time + timedelta(hours=6)
        ):
            result.append(warning)
    return result


def evaluate(bundle):
    config = POLICIES["risk"]
    reference = bundle.reference_time
    expiry = min(
        reference + timedelta(hours=1),
        bundle.retrieved_at + timedelta(seconds=settings.cache_max_seconds),
    )
    risk = {
        "score": None,
        "category": "unavailable",
        "components": [],
        "missing": [],
        "coverage": "unavailable",
        "status": bundle.status,
        "source": bundle.source,
        "last_updated": bundle.retrieved_at,
        "expires_at": expiry,
        "version": config["version"],
        "horizon_hours": config["horizon_hours"],
        "method": "Sum of capped component contributions, capped at 100. Worst available input per component in six hours; not a calibrated probability or official index.",
    }
    safety = {
        "emergency": False,
        "hazards": [],
        "official_warnings": [],
        "status": bundle.status,
        "expires_at": expiry,
    }
    age = (reference - bundle.retrieved_at).total_seconds()
    warnings = applicable_warnings(bundle)
    safety["official_warnings"] = [w.model_dump(mode="json") for w in warnings]
    safety["emergency"] = any(w.severity == "severe" for w in warnings)
    if bundle.status == "unavailable" or not 0 <= age <= settings.cache_max_seconds:
        return risk, safety
    points = (
        [bundle.current] if abs((bundle.current.time - reference).total_seconds()) <= 3600 else []
    ) + [
        p
        for p in bundle.hourly
        if reference <= p.time < reference + timedelta(hours=config["horizon_hours"])
    ]
    hazards = []
    for key, rule in config["components"].items():
        if key == "aqi":
            metric = bundle.air_quality.get(key)
            inputs = [(metric, metric.valid_at if metric else reference)]
        else:
            inputs = [(p.metrics.get(key), p.time) for p in points]
        inputs = [
            (m, at)
            for m, at in inputs
            if valid_metric(m, reference)
            and abs((at - reference).total_seconds()) <= config["horizon_hours"] * 3600
        ]
        if not inputs:
            risk["missing"].append(key)
            continue
        metric, at = (min if rule.get("reverse") else max)(inputs, key=lambda item: item[0].value)
        fraction = (metric.value - rule["start"]) / (rule["full"] - rule["start"])
        contribution = round(max(0, min(1, fraction)) * rule["weight"], 1)
        if key == "humidity":
            hot = any(
                valid_metric(p.metrics.get("temperature"), reference)
                and p.metrics["temperature"].value >= 30
                for p in points
            )
            if not hot:
                contribution = 0
        risk["components"].append(
            {
                "key": key,
                "value": metric.value,
                "unit": metric.unit,
                "points": contribution,
                "maximum": rule["weight"],
                "thresholds": rule,
                "valid_at": at,
                "source": metric.source,
                "status": metric.status,
                "last_updated": metric.retrieved_at,
                "expires_at": metric.expires_at,
            }
        )
        critical = rule.get("critical")
        if critical is not None and (
            metric.value <= critical if rule.get("reverse") else metric.value >= critical
        ):
            hazards.append(
                {
                    "code": key,
                    "value": metric.value,
                    "unit": metric.unit,
                    "start": at,
                    "end": at + timedelta(hours=1),
                    "source": metric.source,
                    "status": metric.status,
                    "rule_id": "critical_" + key,
                    "threshold": critical,
                }
            )
    storm = next((p for p in points if p.code in config["critical_storm_codes"]), None)
    if not any(p.code is not None for p in points):
        risk["missing"].append("thunderstorm")
    else:
        risk["components"].append(
            {
                "key": "thunderstorm",
                "value": storm.code if storm else 0,
                "unit": "WMO code",
                "points": config["storm_weight"] if storm else 0,
                "maximum": config["storm_weight"],
                "valid_at": storm.time if storm else reference,
                "source": bundle.source,
                "status": bundle.status,
                "thresholds": {"codes": config["critical_storm_codes"]},
            }
        )
    if storm:
        hazards.append(
            {
                "code": "thunderstorm",
                "start": storm.time,
                "end": storm.time + timedelta(hours=1),
                "value": storm.code,
                "unit": "WMO code",
                "source": bundle.source,
                "status": bundle.status,
                "rule_id": "critical_thunderstorm",
            }
        )
    waves = bundle.marine.get("wave_height")
    if valid_metric(waves, reference) and waves.value >= config["critical_wave_height"]:
        hazards.append(
            {
                "code": "coastal",
                "start": waves.valid_at,
                "end": waves.valid_at + timedelta(hours=1),
                "value": waves.value,
                "unit": "m",
                "source": waves.source,
                "status": waves.status,
                "rule_id": "critical_waves",
            }
        )
    warnings = applicable_warnings(bundle)
    safety["official_warnings"] = [w.model_dump(mode="json") for w in warnings]
    if warnings:
        severity_points = {"info": 0, "caution": 15, "warning": 40, "severe": 75}
        points_official = max(severity_points[w.severity] for w in warnings)
        risk["components"].append(
            {
                "key": "official_warning",
                "points": points_official,
                "maximum": 75,
                "source": ", ".join(sorted({w.authority for w in warnings})),
            }
        )
    available = len(config["components"]) - len(
        [k for k in risk["missing"] if k in config["components"]]
    )
    if available:
        risk["score"] = round(min(100, sum(item["points"] for item in risk["components"])))
        risk["category"] = "low"
        for category, threshold in config["categories"].items():
            if risk["score"] >= threshold:
                risk["category"] = category
        risk["coverage"] = "partial" if risk["missing"] else "complete"
    safety["hazards"] = hazards
    safety["emergency"] = bool(hazards or any(w.severity == "severe" for w in warnings))
    return risk, safety
