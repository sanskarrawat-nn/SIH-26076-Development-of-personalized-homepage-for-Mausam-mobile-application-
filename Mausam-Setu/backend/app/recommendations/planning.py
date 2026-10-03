"""Schedule-aware planning. Scores are documented heuristics, never safety probabilities."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.utils.calculations import value
from app.utils.time import add_hours, resolve_local_time, utc

PLANT_SOURCE = "https://agritech.tnau.ac.in/org_farm/orgfarm_tomato_climate.html"


def local_start(bundle, clock, day=None):
    zone = ZoneInfo(bundle.location.timezone)
    day = day or bundle.reference_time.astimezone(zone).date()
    hour, minute = map(int, clock.split(":"))
    return resolve_local_time(
        datetime(day.year, day.month, day.day, hour, minute), bundle.location.timezone
    )


def period(bundle, start, hours):
    """Require contiguous hourly support for the WHOLE requested interval."""
    start = utc(start)
    end = start + timedelta(hours=hours)
    if start < bundle.reference_time or bundle.status == "unavailable":
        return []
    points = sorted(
        [point for point in bundle.hourly if point.time < end and add_hours(point.time, 1) > start],
        key=lambda point: point.time,
    )
    if not points or points[0].time > start or add_hours(points[-1].time, 1) < end:
        return []
    if any(
        utc(next_point.time) - utc(previous_point.time) != timedelta(hours=1)
        for previous_point, next_point in zip(points, points[1:])
    ):
        return []
    return points


def assessment(points, aqi_limit=100):
    keys = ["feels_like", "humidity", "wind", "rain_probability", "uv", "visibility"]
    if not points or any(value(point.metrics, k) is None for point in points for k in keys):
        return {
            "available": False,
            "message": "Complete forecast coverage is unavailable for this period.",
        }
    metric_values = {k: [value(point.metrics, k) for point in points] for k in keys}
    concerns = []
    for condition, label in [
        (max(metric_values["feels_like"]) >= 32, "Heat"),
        (min(metric_values["feels_like"]) <= 5, "Cold"),
        (max(metric_values["rain_probability"]) >= 60, "Rain"),
        (max(metric_values["wind"]) >= 35, "Strong wind"),
        (max(metric_values["uv"]) >= 6, "High UV"),
        (min(metric_values["visibility"]) < 1000, "Low visibility"),
        (any(point.code in (95, 96, 99) for point in points), "Thunderstorms"),
    ]:
        if condition:
            concerns.append(label)

    # Worst-hour comfort: temperature (0..60), humidity (0..20), wind (0..20).
    def score(point):
        feels_like = value(point.metrics, "feels_like")
        humidity = value(point.metrics, "humidity")
        wind_speed = value(point.metrics, "wind")
        penalty = (
            min(60, max(0, 18 - feels_like, feels_like - 26) * 5)
            + min(20, max(0, 35 - humidity, humidity - 65) * 0.5)
            + min(20, max(0, wind_speed - 15))
        )
        return round(max(0, 100 - penalty))

    air = [value(point.metrics, "aqi") for point in points]
    peak_aqi = max(air) if air and all(v is not None for v in air) else None
    if peak_aqi is not None and peak_aqi > aqi_limit:
        concerns.append("Poor air quality")
    comfort = min(score(point) for point in points)
    return {
        "available": True,
        "comfort": comfort,
        "peak_us_aqi": peak_aqi,
        "aqi": f"Peak forecast US AQI: {peak_aqi:g}; not Indian NAQI."
        if peak_aqi is not None
        else "Hourly AQI unavailable; current US AQI is not a forecast for this window.",
        "comfort_label": "Comfortable"
        if comfort >= 75
        else "Mixed comfort"
        if comfort >= 45
        else "Uncomfortable",
        "rain_probability": max(metric_values["rain_probability"]),
        "concerns": concerns,
        "message": ", ".join(concerns)
        if concerns
        else "No configured weather thresholds triggered.",
        "formula": "Worst hourly score: 100 minus temperature penalty (up to 60), humidity penalty (20), and wind penalty (20). Rain, UV, visibility and storms are assessed separately. This is a planning heuristic.",
    }


def fitness(bundle, options, day=None):
    duration = options.duration_minutes / 60
    zone = ZoneInfo(bundle.location.timezone)
    heat_limit = {"light": 32, "moderate": 30, "vigorous": 28}[options.intensity]
    wind_limit = 20 if options.exercise == "cycling" else 25
    candidates = []
    for point in bundle.hourly[:72]:
        start = point.time
        end = add_hours(start, duration)
        local = start.astimezone(zone)
        local_end = end.astimezone(zone)
        if day is not None and local.date() != day:
            continue
        if (
            local.hour < options.preferred_start
            or (local_end.hour + local_end.minute / 60) > options.preferred_end
            or local.date() != local_end.date()
        ):
            continue
        points = period(bundle, start, duration)
        result = assessment(points)
        if not result["available"] or result["concerns"]:
            continue
        if not any(
            d.sunrise and d.sunset and start >= d.sunrise and end <= d.sunset for d in bundle.daily
        ):
            continue
        if any(
            value(point.metrics, "feels_like") > heat_limit
            or value(point.metrics, "wind") > wind_limit
            or value(point.metrics, "humidity") > 85
            or value(point.metrics, "rain_probability") > 40
            or value(point.metrics, "uv") > 5
            or value(point.metrics, "visibility") < 1500
            for point in points
        ):
            continue
        air_limit = 75 if "air" in options.sensitivities else 100
        if any((value(point.metrics, "aqi") or 0) > air_limit for point in points):
            continue
        aqi = value(bundle.air_quality, "aqi")
        if aqi is not None and aqi > (75 if "air" in options.sensitivities else 100):
            continue
        candidates.append((result["comfort"], start, end))
    if not candidates:
        return {
            "available": False,
            "message": "No complete daylight session matches your hours, duration and intensity limits.",
        }
    best_score, start, end = max(candidates, key=lambda x: (x[0], -x[1].timestamp()))
    return {
        "available": True,
        "start": start,
        "end": end,
        "message": f"{options.duration_minutes}-minute {options.exercise} session; {options.intensity} intensity. Highest worst-hour comfort among complete daylight candidates ({best_score}/100), within your heat, humidity, wind, rain, UV and visibility limits.",
        "limitations": "Current and available hourly US AQI are screened. Missing hourly AQI does not establish clean air. Route conditions are not included. Recheck before leaving.",
    }


def school(bundle, options):
    results = []
    for label, clock in (("Drop-off", options.school_dropoff), ("Pickup", options.school_pickup)):
        try:
            start = local_start(bundle, clock)
            if start < bundle.reference_time:
                next_day = start.date() + timedelta(days=1)
                start = local_start(bundle, clock, next_day)
            result = assessment(
                period(bundle, start, 1), 75 if "air" in options.sensitivities else 100
            )
            results.append({"label": label, "start": start, "end": add_hours(start, 1), **result})
        except ValueError as error:
            results.append({"label": label, "available": False, "message": str(error)})
    return results


def event(bundle, options):
    try:
        start = local_start(bundle, options.event_start, options.event_date)
    except ValueError as error:
        return {"available": False, "message": str(error)}
    points = period(bundle, start, options.event_hours)
    result = assessment(points)
    return {
        "start": start,
        "end": add_hours(start, options.event_hours),
        **result,
        "rain_timing": [
            p.time for p in points if (value(p.metrics, "rain_probability") or 0) >= 60
        ],
        "limitations": "Full-duration forecast screening. Hourly US AQI is included only with complete coverage; otherwise air quality is unavailable. Recheck before starting.",
        "backup": "Indoor backup selected. Recheck the forecast before the event."
        if options.event_shelter
        else "Arrange a sheltered backup if weather concerns are flagged.",
    }


def planting(bundle, options):
    day = (
        options.planting_date
        or bundle.reference_time.astimezone(ZoneInfo(bundle.location.timezone)).date()
    )
    if options.crop == "none":
        return {"available": False, "message": "Select a crop and growing region in Your plans."}
    calendars = {
        ("tomato", "south_india"): (
            "Tomato",
            "South India",
            day.month in (1, 2, 6, 7, 10, 11),
            "January–February, June–July and October–November",
            PLANT_SOURCE,
        ),
        ("okra", "tamil_nadu"): (
            "Okra / bhendi",
            "Tamil Nadu",
            day.month in (2, 6, 7, 8),
            "February and June–August",
            "https://agritech.tnau.ac.in/horticulture/horti_vegetables_bhendi_Soil.html",
        ),
        ("wheat_hd3226", "north_western_plains"): (
            "Wheat HD 3226",
            "North Western Plains Zone",
            day.month == 11 and 5 <= day.day <= 25,
            "5–25 November; irrigated, timely-sown HD 3226 variety only",
            "https://www.icar.gov.in/node/12081",
        ),
    }
    entry = calendars.get((options.crop, options.growing_region))
    if not entry:
        return {
            "available": False,
            "message": "No sourced calendar for this crop/region combination. Supported: South India tomato, Tamil Nadu okra, North Western Plains wheat HD 3226.",
        }
    crop, region, in_season, season, source = entry
    frost = options.crop != "wheat_hd3226" and any(
        value(point.metrics, "temperature") is not None and value(point.metrics, "temperature") <= 0
        for point in bundle.hourly[:48]
    )
    return {
        "available": True,
        "crop": crop,
        "region": region + " (selected by you)",
        "date": day,
        "message": crop
        + ": "
        + ("Within" if in_season else "Outside")
        + " the sourced calendar for "
        + region
        + ": "
        + season
        + ".",
        "caution": ("Freezing temperatures are forecast in the next 48 hours. " if frost else "")
        + "Calendar guidance is not a planting guarantee. Confirm variety, local conditions and nursery/transplant timing with local extension advice.",
        "source": source,
        "in_season": in_season,
    }


def build_planning(bundle, profile):
    from app.recommendations.extended import extended_planning

    options = profile.planning
    result = extended_planning(bundle, profile)
    if "fitness" in profile.interests:
        result["fitness"] = fitness(bundle, options)
        tomorrow = bundle.reference_time.astimezone(
            ZoneInfo(bundle.location.timezone)
        ).date() + timedelta(days=1)
        morning = options.model_copy(
            update={
                "preferred_start": max(5, options.preferred_start),
                "preferred_end": min(12, options.preferred_end),
            }
        )
        result["fitness_tomorrow_morning"] = fitness(bundle, morning, tomorrow)
    if "family" in profile.interests:
        result["school"] = school(bundle, options)
    if "events" in profile.interests:
        result["event"] = event(bundle, options)
    if "agriculture" in profile.interests:
        result["planting"] = planting(bundle, options)
    if "health" in profile.interests:
        result["sensitivities"] = options.sensitivities
    return result
