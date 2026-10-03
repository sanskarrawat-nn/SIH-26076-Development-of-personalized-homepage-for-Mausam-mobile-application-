from datetime import timedelta

from app.core.config import POLICIES
from app.schemas.weather import WeatherAlert
from app.utils.calculations import value


def generate_alerts(bundle):
    if bundle.status == "unavailable":
        return []
    t = POLICIES["thresholds"]
    m = bundle.current.metrics
    rules = [
        (
            "heat",
            value(m, "temperature"),
            t["heat"],
            "gte",
            "warning",
            "High temperature",
            "Consider reducing prolonged heat exposure.",
        ),
        (
            "uv",
            value(m, "uv"),
            t["uv"],
            "gte",
            "caution",
            "High UV",
            "Consider shade and sun protection.",
        ),
        (
            "rain",
            value(m, "rain_probability"),
            t["rain"],
            "gte",
            "warning",
            "Rain likely",
            "Allow flexibility in outdoor plans.",
        ),
        (
            "wind",
            value(m, "wind"),
            t["wind"],
            "gte",
            "warning",
            "Strong wind",
            "Check local conditions before outdoor plans.",
        ),
        (
            "fog",
            value(m, "visibility"),
            t["fog_m"],
            "lt",
            "warning",
            "Low visibility",
            "Allow more time and check local visibility.",
        ),
        (
            "air",
            value(bundle.air_quality, "aqi"),
            t["aqi"],
            "gt",
            "warning",
            "Elevated US AQI",
            "Sensitive people may prefer less prolonged outdoor activity.",
        ),
        (
            "frost",
            value(m, "temperature"),
            t["frost"],
            "lte",
            "caution",
            "Freezing conditions",
            "Consider protection for frost-sensitive plants.",
        ),
    ]
    output = []
    for typ, v, threshold, op, severity, title, message in rules:
        if v is None:
            continue
        matched = {
            "gte": v >= threshold,
            "gt": v > threshold,
            "lt": v < threshold,
            "lte": v <= threshold,
        }[op]
        if not matched:
            continue
        output.append(
            WeatherAlert(
                id=f"{typ}:{bundle.location.latitude:.2f}:{bundle.location.longitude:.2f}",
                type=typ,
                severity=severity,
                location=bundle.location,
                start_time=bundle.reference_time,
                end_time=bundle.reference_time + timedelta(hours=1),
                message=f"{title}. {message}",
                reason=f"Input {v:g}; screening threshold {threshold:g}. App-generated advisory, not an official warning.",
                source=bundle.source,
                status=bundle.status,
            )
        )
    # Advance advisories are distinct from current conditions and expire quickly
    # so a disconnected client cannot keep presenting an old forecast as fresh.
    future = [
        p
        for p in bundle.hourly
        if bundle.reference_time < p.time <= bundle.reference_time + timedelta(hours=48)
    ]
    for typ, key, threshold, match, title in [
        ("heat", "temperature", t["heat"], lambda v, x: v >= x, "Heat forecast"),
        ("frost", "temperature", t["frost"], lambda v, x: v <= x, "Freezing temperatures forecast"),
        ("rain", "rain_probability", t["rain"], lambda v, x: v >= x, "Rain likely"),
        ("fog", "visibility", t["fog_m"], lambda v, x: v < x, "Low visibility forecast"),
        ("storm", None, None, None, "Thunderstorms forecast"),
    ]:
        point = next(
            (
                p
                for p in future
                if (
                    p.code in (95, 96, 99)
                    if key is None
                    else value(p.metrics, key) is not None
                    and match(value(p.metrics, key), threshold)
                )
            ),
            None,
        )
        if not point:
            continue
        from zoneinfo import ZoneInfo

        when = point.time.astimezone(ZoneInfo(bundle.location.timezone)).strftime("%d %b, %H:%M")
        output.append(
            WeatherAlert(
                id=f"forecast-{typ}:{bundle.location.latitude:.2f}:{bundle.location.longitude:.2f}:{point.time.isoformat()}",
                type=f"forecast-{typ}",
                severity="caution" if typ == "frost" else "warning",
                location=bundle.location,
                start_time=point.time,
                end_time=point.time + timedelta(hours=1),
                message=f"{title} from {when} ({bundle.location.timezone}). Recheck before your plans.",
                reason="First matching forecast hour in the next 48 hours. App-generated advisory, not an official warning.",
                source=bundle.source,
                status=bundle.status,
            )
        )
    return output
