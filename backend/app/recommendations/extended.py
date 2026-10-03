"""Part 2 planning heuristics. No medical, landslide or navigation predictions."""

from datetime import timedelta

from app.recommendations.planning import assessment, fitness, local_start, period
from app.utils.calculations import value


def next_window(bundle, clock, duration=1, offset=0, air_limit=100):
    start = local_start(bundle, clock) - timedelta(minutes=offset)
    if start < bundle.reference_time:
        start += timedelta(days=1)
    result = assessment(period(bundle, start, duration), air_limit)
    return {
        "start": start,
        "end": start + timedelta(hours=duration),
        **result,
        "source": bundle.source,
        "status": bundle.status,
    }


def student_windows(bundle, options):
    air_limit = 75 if "air" in options.sensitivities else 100
    windows = [
        {
            "label": "College departure",
            **next_window(
                bundle,
                options.student_start,
                options.commute_minutes / 60,
                options.commute_minutes,
                air_limit,
            ),
        },
        {
            "label": "Return commute",
            **next_window(
                bundle, options.student_end, options.commute_minutes / 60, air_limit=air_limit
            ),
        },
    ]
    if options.student_activity != "none":
        windows.append(
            {
                "label": "Outdoor practice",
                "activity": options.student_activity,
                **next_window(bundle, options.practice_time, 1, air_limit=air_limit),
            }
        )
    return windows


def student(bundle, profile):
    windows = student_windows(bundle, profile.planning)
    concerns = [
        w["label"] + ": " + w["message"] for w in windows if w["available"] and w["concerns"]
    ]
    return dict(
        title="Your student day",
        message=(
            " ".join(concerns)
            + " Carry rain protection if rain is flagged; allow extra travel time. Consider an indoor practice backup."
            if concerns
            else "Check departure, return and practice windows in Your plans. Recheck before leaving."
        ),
        reasons=[
            "Uses your college hours, commute duration and practice time.",
            "Transport: " + profile.planning.transport_mode,
        ],
        metrics=["rain_probability", "visibility", "aqi"],
        risk=0.65 if concerns else 0.2,
    )


def highland(bundle, profile):
    points = [
        p
        for p in bundle.hourly
        if bundle.reference_time <= p.time < bundle.reference_time + timedelta(hours=24)
    ]
    concerns = []
    for key, predicate, text in [
        ("visibility", lambda v: v < 500, "Very low modelled visibility"),
        ("temperature", lambda v: v <= 0, "Freezing temperatures"),
        ("wind", lambda v: v >= 35, "Strong winds"),
        ("wind_gusts", lambda v: v >= 50, "Strong gusts"),
    ]:
        found = next(
            (
                p
                for p in points
                if value(p.metrics, key) is not None and predicate(value(p.metrics, key))
            ),
            None,
        )
        if found:
            concerns.append(f"{text} near {found.time.isoformat()}.")
    return dict(
        title="Hill / Highland outlook",
        message=" ".join(concerns)
        + " Check local road advisories before hill travel. Forecast grids may miss mountain microclimates. This is not a landslide prediction.",
        reasons=["Screens next 24 hours for fog, freezing temperatures and wind."],
        metrics=["visibility", "precipitation", "temperature", "wind"],
        risk=0.7 if concerns else 0.2,
    )


def extended_planning(bundle, profile):
    result = {}
    options = profile.planning
    if "student" in profile.interests:
        result["student"] = student_windows(bundle, options)
    if "commute" in profile.interests:
        result["commute"] = [
            {
                "label": "Departure",
                **next_window(bundle, options.commute_departure, options.commute_minutes / 60),
            },
            {
                "label": "Return",
                **next_window(bundle, options.commute_return, options.commute_minutes / 60),
            },
        ]
    if "family" in profile.interests:
        play = options.model_copy(
            update={"exercise": "walking", "intensity": "light", "duration_minutes": 30}
        )
        result["play"] = {
            **fitness(bundle, play),
            "scope": "Weather screening only; adult supervision and local conditions matter.",
        }
    points = period(bundle, bundle.reference_time, 24)
    rain = [value(p.metrics, "precipitation") for p in points]
    accumulation = sum(rain) if rain and all(v is not None for v in rain) else None
    if "hill" in profile.interests:
        temps = [value(p.metrics, "temperature") for p in points]
        result["hill"] = {
            "forecast_rain_24h_mm": round(accumulation, 1) if accumulation is not None else None,
            "temperature_range_c": round(max(temps) - min(temps), 1)
            if temps and all(v is not None for v in temps)
            else None,
            "recent_observed_rain": "unavailable",
            "altitude": "unavailable",
            "message": "Forecast rainfall is not observed accumulation. No validated slope-instability or landslide model is connected.",
        }
    if "agriculture" in profile.interests:
        risky = [
            p
            for p in points
            if (value(p.metrics, "wind") or 0) >= 15
            or (value(p.metrics, "rain_probability") or 0) >= 40
        ]
        complete = bool(points) and all(
            value(p.metrics, k) is not None
            for p in points
            for k in ("wind", "humidity", "rain_probability")
        )
        result["agriculture"] = {
            "growth_stage": options.growth_stage,
            "crop": options.crop,
            "forecast_rain_24h_mm": round(accumulation, 1) if accumulation is not None else None,
            "message": "Spraying-weather assessment unavailable."
            if not complete
            else "Rain or wind may limit spraying windows. Follow product labels and local extension advice."
            if risky
            else "No selected rain/wind screening threshold triggered. This does not establish spraying suitability.",
            "irrigation": "Review forecast rain and measured field moisture before irrigation; quantities and crop-specific timing require local agronomic advice.",
            "advisory_status": "ICAR adapter unconfigured",
            "heat_stress": any((value(p.metrics, "temperature") or 0) >= 35 for p in points)
            if points
            else None,
        }
    if "health" in profile.interests:
        result["exposure"] = {
            "aqi_scale": "US AQI, not Indian NAQI",
            "current_us_aqi": value(bundle.air_quality, "aqi"),
            "sensitivity_threshold": 75 if "air" in options.sensitivities else 100,
            "windows": [
                {
                    "label": "Morning exposure",
                    **next_window(
                        bundle, "08:00", air_limit=75 if "air" in options.sensitivities else 100
                    ),
                },
                {
                    "label": "Afternoon exposure",
                    **next_window(
                        bundle, "15:00", air_limit=75 if "air" in options.sensitivities else 100
                    ),
                },
            ],
            "scope": "Environmental screening only, not diagnosis. Hourly AQI is included only with complete coverage; unsupported pollen remains unavailable.",
        }
    if "marine" in profile.interests:
        wave = value(bundle.marine, "wave_height")
        result["coastal"] = {
            "score": min(100, round(wave / 4 * 100)) if wave is not None else None,
            "formula": "Wave-height screening index: min(100, wave metres / 4 × 100). Not a validated navigation risk score.",
            "message": "High waves; postpone small-craft activity and check INCOIS warnings."
            if wave is not None and wave >= 2.5
            else "Check sea-state, tide predictions and INCOIS warnings before coastal activity. A low score does not establish safety.",
            "status": bundle.marine.get("wave_height").status
            if bundle.marine.get("wave_height")
            else "unavailable",
            "official_priority": "INCOIS warnings take precedence over modelled waves.",
            "tides": "Request the Tide Planner; no tide level is inferred from wave height.",
        }
    result["near_term"] = [
        {
            "at": p.time,
            "precipitation": p.metrics.get("precipitation"),
            "rain_probability": p.metrics.get("rain_probability"),
        }
        for p in bundle.hourly
        if bundle.reference_time <= p.time < bundle.reference_time + timedelta(hours=6)
    ]
    return result
