"""Transparent screening heuristics, not calibrated probabilities or medical models."""

from datetime import timedelta

from app.core.config import POLICIES


def value(metrics, key):
    m = metrics.get(key)
    return m.value if m and m.status != "unavailable" else None


def total_rain(points):
    vals = [value(p.metrics, "precipitation") for p in points]
    return sum(vals) if vals and all(v is not None for v in vals) else None


def activity_window(bundle):
    cfg = POLICIES["window"]
    candidates = []
    # Evaluate two consecutive forecast hours with daylight and sufficient inputs.
    future = [p for p in bundle.hourly if p.time >= bundle.reference_time][:48]
    for first, second in zip(future, future[1:]):
        if second.time - first.time != timedelta(hours=1):
            continue
        end = second.time + timedelta(hours=1)
        if not any(
            d.sunrise and d.sunset and first.time >= d.sunrise and end <= d.sunset
            for d in bundle.daily
        ):
            continue
        reasons = []
        risk = []
        complete = True
        for p in [first, second]:
            vals = {
                k: value(p.metrics, k)
                for k in [
                    "temperature",
                    "feels_like",
                    "rain_probability",
                    "wind",
                    "uv",
                    "visibility",
                    "humidity",
                ]
            }
            if any(v is None for v in vals.values()):
                complete = False
                break
            acceptable = (
                vals["temperature"] >= cfg["min_temp"]
                and vals["feels_like"] <= cfg["max_feels"]
                and vals["rain_probability"] <= cfg["max_rain"]
                and vals["wind"] <= cfg["max_wind"]
                and vals["uv"] <= cfg["max_uv"]
                and vals["visibility"] >= cfg["min_visibility"]
                and vals["humidity"] <= cfg["max_humidity"]
            )
            if not acceptable:
                complete = False
                break
            risk.append(
                vals["feels_like"] / cfg["max_feels"]
                + vals["rain_probability"] / 100
                + vals["uv"] / 10
                + vals["wind"] / 50
            )
        if not complete:
            continue
        aqi = value(bundle.air_quality, "aqi")
        if aqi is not None and aqi > cfg["max_aqi"]:
            continue
        reasons = [
            "Both forecast hours meet the configured temperature, humidity, rain, wind, UV and visibility limits.",
            "The full window is within forecast daylight.",
            "Hourly air-quality forecasts are not included in this screening; check air quality again before departure.",
        ]
        candidates.append((sum(risk), first.time, end, reasons))
    return min(candidates, key=lambda x: (x[0], x[1])) if candidates else None
