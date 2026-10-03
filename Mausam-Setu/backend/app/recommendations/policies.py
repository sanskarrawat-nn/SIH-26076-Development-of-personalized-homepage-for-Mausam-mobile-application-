from datetime import timedelta

from app.core.config import POLICIES
from app.recommendations.extended import highland, student
from app.recommendations.planning import event, fitness
from app.recommendations.planning import school as school_plan
from app.utils.calculations import total_rain, value


def exposure(bundle, profile):
    metrics = bundle.current.metrics
    aqi = value(bundle.air_quality, "aqi")
    uv = value(metrics, "uv")
    temperature = value(metrics, "temperature")
    humidity = value(metrics, "humidity")
    concerns = []
    if humidity is not None and humidity > 80:
        concerns.append("High humidity may make outdoor exertion feel less comfortable.")
    if aqi is not None and aqi > POLICIES["thresholds"]["aqi"]:
        concerns.append(
            "Air quality may make prolonged outdoor activity less comfortable for sensitive people."
        )
    if uv is not None and uv >= POLICIES["thresholds"]["uv"]:
        concerns.append("Consider shade and sun protection during high UV.")
    if temperature is not None and temperature >= POLICIES["thresholds"]["heat"]:
        concerns.append("Consider reducing prolonged heat exposure.")
    selected = profile.planning.sensitivities
    if "air" in selected and aqi is not None and aqi > 75:
        concerns.append("Your air-sensitivity preference uses an earlier caution threshold.")
    if "sun" in selected and uv is not None and uv >= 3:
        concerns.append("Your sun-sensitivity preference highlights UV from index 3.")
    if "heat" in selected and temperature is not None and temperature >= 30:
        concerns.append("Your heat-sensitivity preference highlights temperatures from 30 °C.")
    if "pollen" in selected:
        pollen = [
            value(bundle.air_quality, k) for k in ["grass_pollen", "birch_pollen", "alder_pollen"]
        ]
        concerns.append(
            "Review the pollen counts below and your usual allergy plan."
            if any(v is not None for v in pollen)
            else "Local pollen counts are unavailable; an allergy-specific exposure assessment cannot be made."
        )
    return {
        "title": "Your outdoor exposure check",
        "message": " ".join(concerns)
        or "Review air quality, UV and temperature before prolonged outdoor activity.",
        "reasons": [
            f"{k}: {v:g}"
            for k, v in [
                ("US AQI", aqi),
                ("UV", uv),
                ("Temperature °C", temperature),
                ("Humidity %", humidity),
            ]
            if v is not None
        ],
        "risk": min(1, len(concerns) / 2),
        "group": "outdoor",
        "metrics": ["aqi", "uv", "temperature", "humidity"],
    }


def outdoor(bundle, profile):
    session = fitness(bundle, profile.planning)
    window = (
        (0, session["start"], session["end"], [session["message"], session["limitations"]])
        if session["available"]
        else None
    )
    if not window:
        return {
            "title": "Outdoor activity: use caution",
            "message": "Unable to determine a reliable outdoor window from the available forecast.",
            "reasons": [
                "No complete daylight session matches your selected duration, hours and intensity.",
                "Heat, rain, humidity, wind, UV, visibility or air quality may limit the options.",
            ],
            "risk": 0.8,
            "group": "outdoor",
            "metrics": ["feels_like", "uv", "wind"],
        }
    return {
        "title": "A better window to head outside",
        "message": "This session matches your activity preferences and forecast screening limits. Recheck conditions before leaving.",
        "reasons": window[3],
        "risk": 0.2,
        "group": "outdoor",
        "metrics": ["feels_like", "uv", "wind"],
        "window_start": window[1],
        "window_end": window[2],
    }


def packing(bundle, profile):
    vals = [value(x.metrics, "rain_probability") for x in bundle.hourly[:24]]
    rain = max([v for v in vals if v is not None], default=None)
    temperature = value(bundle.current.metrics, "temperature")
    uv = value(bundle.current.metrics, "uv")
    items = []
    reasons = []
    if rain is not None:
        reasons.append(f"Peak rain probability in the next 24 forecast hours: {rain:g}%.")
        if rain >= POLICIES["thresholds"]["rain"]:
            items.append("Pack an umbrella or rain protection.")
    if temperature is not None and temperature < POLICIES["thresholds"]["cold"]:
        items.append("Pack warm clothing.")
    if (uv is not None and uv >= POLICIES["thresholds"]["uv"]) or (
        temperature is not None and temperature >= POLICIES["thresholds"]["heat"]
    ):
        items.append("Pack sun protection and drinking water.")
    if temperature is not None:
        reasons.append(f"Current temperature: {temperature:g} °C.")
    return {
        "title": f"Packing for {bundle.location.name.split(',')[0]}",
        "message": " ".join(items)
        or "No extra weather-specific packing item is triggered by the available inputs.",
        "reasons": reasons,
        "risk": 0.8 if items else 0.1,
        "metrics": ["rain_probability", "temperature", "wind"],
    }


def school(bundle, profile):
    periods = school_plan(bundle, profile.planning)
    reasons = [f"{r['label']}: {r['message']}" for r in periods]
    return {
        "title": "Your family day, checked",
        "message": (
            "Carry rain protection for the flagged school periods. "
            if any("Rain" in r.get("concerns", []) for r in periods)
            else ""
        )
        + "Your school-time forecast at the selected location. Use the journey planner to check both home and school.",
        "reasons": reasons,
        "risk": 0.8 if any(r.get("concerns") for r in periods) else 0.2,
        "metrics": ["rain_probability", "temperature", "visibility"],
    }


def growing(bundle, profile):
    # Provider precipitation is accumulated over the preceding hour.
    intervals = [x for x in bundle.hourly if x.time - timedelta(hours=1) >= bundle.reference_time][
        :24
    ]
    complete = len(intervals) == 24 and all(
        y.time - x.time == timedelta(hours=1) for x, y in zip(intervals, intervals[1:])
    )
    rain = total_rain(intervals) if complete else None
    message = "Rainfall coverage is incomplete; a reliable accumulation is unavailable."
    if rain is not None:
        message = f"{rain:g} mm forecast across the next 24 complete hourly intervals. " + (
            "Consider reassessing planned irrigation after checking soil conditions."
            if rain >= POLICIES["thresholds"]["heavy_rain_mm"]
            else "Check soil conditions before deciding whether to irrigate."
        )
    return {
        "title": "Rainfall & your growing plans",
        "message": message,
        "reasons": [
            "Summed hourly precipitation; forecast rainfall is not measured rainfall.",
            "Soil moisture, when present, is modelled at the labelled depth. Crop stage and soil type are unknown; no irrigation dose is calculated.",
        ],
        "risk": 0.8
        if rain is not None and rain >= POLICIES["thresholds"]["heavy_rain_mm"]
        else 0.2,
        "metrics": ["precipitation", "humidity", "wind"],
    }


def journey(bundle, profile):
    visibility = value(bundle.current.metrics, "visibility")
    rain = value(bundle.current.metrics, "rain_probability")
    concerns = []
    if visibility is not None and visibility < POLICIES["thresholds"]["fog_m"]:
        concerns.append("Low visibility may affect your journey. Allow extra time.")
    if rain is not None and rain >= POLICIES["thresholds"]["rain"]:
        concerns.append("Rain is likely; plan for a wet journey.")
    return {
        "title": "Before you leave",
        "message": " ".join(concerns) or "Check the hourly forecast around your departure time.",
        "reasons": ["Weather screening only. Traffic data and road closures are unavailable."]
        + [f"Visibility: {visibility:g} m." for _ in [0] if visibility is not None],
        "risk": 0.8 if concerns else 0.1,
        "metrics": ["visibility", "rain_probability", "wind"],
    }


def coast(bundle, profile):
    wave = value(bundle.marine, "wave_height")
    return {
        "title": "Your coastal conditions",
        "message": f"Modelled wave height: {wave:g} m. Check official local marine warnings before water activities."
        if wave is not None
        else "Marine conditions unavailable for this location. Weather alone cannot establish water safety.",
        "reasons": [
            "Marine and land-weather data are separate.",
            "Tides and official marine warnings are not connected.",
        ],
        "risk": 0.3,
        "metrics": ["wave_height", "wave_period", "water_temperature"],
    }


def planning(bundle, profile):
    result = event(bundle, profile.planning)
    return {
        "title": "Plan your outdoor event",
        "message": (
            f"Comfort {result['comfort']}/100 — {result['comfort_label']}. Peak rain chance {result['rain_probability']:g}%. "
            if result["available"]
            else ""
        )
        + result["message"],
        "reasons": [
            result.get("backup", "Check the selected local time."),
            result.get("formula", "Choose a future event within the forecast horizon."),
        ],
        "risk": 0.8 if result.get("concerns") else 0.2,
        "metrics": ["rain_probability", "wind", "humidity"],
        "window_start": result.get("start") if result["available"] else None,
        "window_end": result.get("end") if result["available"] else None,
    }


RULES = {
    "exposure": exposure,
    "outdoor": outdoor,
    "packing": packing,
    "school": school,
    "growing": growing,
    "journey": journey,
    "coast": coast,
    "planning": planning,
}


RULES.update(student=student, highland=highland)
