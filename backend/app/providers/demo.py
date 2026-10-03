"""Deterministic fixtures; never represented as observed weather."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.providers.open_meteo import FIELDS
from app.schemas.weather import DailyForecast, Metric, OfficialWarning, WeatherBundle, WeatherPoint

SCENARIOS = {
    "pleasant": {
        "label": "Pleasant day",
        "temperature": 27,
        "humidity": 55,
        "rain_probability": 10,
        "uv": 4,
        "wind": 12,
        "precipitation": 0,
        "aqi": 55,
        "visibility": 12000,
    },
    "heat": {
        "label": "Extreme heat",
        "temperature": 38,
        "humidity": 70,
        "rain_probability": 5,
        "uv": 9,
        "wind": 15,
        "precipitation": 0,
        "aqi": 80,
        "visibility": 10000,
    },
    "rain": {
        "label": "Heavy rain",
        "temperature": 27,
        "humidity": 89,
        "rain_probability": 90,
        "uv": 2,
        "wind": 28,
        "precipitation": 2,
        "aqi": 55,
        "visibility": 3000,
    },
    "air": {
        "label": "Poor air quality",
        "temperature": 30,
        "humidity": 65,
        "rain_probability": 5,
        "uv": 5,
        "wind": 7,
        "precipitation": 0,
        "aqi": 180,
        "visibility": 4000,
    },
    "fog": {
        "label": "Foggy morning",
        "temperature": 17,
        "humidity": 95,
        "rain_probability": 15,
        "uv": 1,
        "wind": 5,
        "precipitation": 0,
        "aqi": 90,
        "visibility": 400,
    },
    "travel_rain": {
        "label": "Destination rain",
        "temperature": 24,
        "humidity": 85,
        "rain_probability": 80,
        "uv": 3,
        "wind": 20,
        "precipitation": 1,
        "aqi": 60,
        "visibility": 5000,
    },
    "agriculture_rain": {
        "label": "Agricultural rainfall",
        "temperature": 28,
        "humidity": 80,
        "rain_probability": 75,
        "uv": 3,
        "wind": 12,
        "precipitation": 0.75,
        "aqi": 60,
        "visibility": 8000,
    },
    "frost": {
        "label": "Overnight frost",
        "temperature": 4,
        "humidity": 60,
        "rain_probability": 5,
        "uv": 2,
        "wind": 5,
        "precipitation": 0,
        "aqi": 40,
        "visibility": 10000,
    },
    "storm": {
        "label": "Thunderstorm",
        "temperature": 28,
        "humidity": 85,
        "rain_probability": 85,
        "uv": 2,
        "wind": 40,
        "precipitation": 3,
        "aqi": 50,
        "visibility": 2000,
    },
    "coast": {
        "label": "Coastal day",
        "temperature": 27,
        "humidity": 65,
        "rain_probability": 15,
        "uv": 4,
        "wind": 15,
        "precipitation": 0,
        "aqi": 40,
        "visibility": 12000,
    },
    "pollen": {
        "label": "Pollen demonstration",
        "temperature": 25,
        "humidity": 50,
        "rain_probability": 5,
        "uv": 4,
        "wind": 12,
        "precipitation": 0,
        "aqi": 45,
        "visibility": 12000,
    },
    "missing": {"label": "No available data"},
}


SCENARIOS.update(
    {
        "student_commute": {**SCENARIOS["rain"], "label": "Student Commute"},
        "hill_fog": {**SCENARIOS["fog"], "label": "Hill Fog"},
        "community_flood": {**SCENARIOS["rain"], "label": "Community Flood Report"},
        "verified_community": {**SCENARIOS["rain"], "label": "Verified Community Report"},
        "route_rain": {**SCENARIOS["rain"], "label": "Route Heavy Rain", "precipitation": 8},
        "emergency": {**SCENARIOS["storm"], "label": "Emergency Mode", "precipitation": 25},
        "severe_aqi": {**SCENARIOS["air"], "label": "Severe AQI", "aqi": 350},
        "official_warning": {**SCENARIOS["pleasant"], "label": "Official Warning (SIMULATED)"},
        "hindi_voice": {**SCENARIOS["pleasant"], "label": "Hindi Voice Example"},
    }
)


def fixture(loc, scenario="pleasant"):
    base = SCENARIOS[scenario]
    ref = datetime(2026, 6, 15, 6, 0, tzinfo=ZoneInfo(loc.timezone))

    def m(value, unit, t):
        return Metric(
            value=value,
            unit=unit,
            source="Deterministic demo scenario",
            retrieved_at=ref,
            valid_at=t,
            location=loc,
            status="simulated" if value is not None else "unavailable",
        )

    if scenario == "missing":
        return WeatherBundle(
            location=loc,
            current=WeatherPoint(time=ref),
            status="unavailable",
            retrieved_at=ref,
            reference_time=ref,
            source="Demo: missing data",
            scenario=scenario,
            notices=["No data fixture. No weather advice can be generated."],
        )
    points = []
    for i in range(168):
        t = ref + timedelta(hours=i)
        daytime = 8 <= t.hour <= 17
        vals = {k: base.get(k) for k in FIELDS}
        vals["temperature"] = base["temperature"] + (0 if daytime else -5)
        vals["feels_like"] = vals["temperature"] + (3 if base["humidity"] >= 70 else 0)
        vals["uv"] = base["uv"] if daytime else 0
        vals["pressure"] = 1004 if scenario in ("storm", "emergency") else 1012
        vals["dew_point"] = vals["temperature"] - (100 - base["humidity"]) / 5
        vals["wind_direction"] = 225
        vals["wind_gusts"] = base["wind"] * 1.4
        if scenario in ("rain", "travel_rain") and 6 <= t.hour < 10:
            vals["rain_probability"] = 35
        points.append(
            WeatherPoint(
                time=t,
                metrics={k: m(v, FIELDS[k][1], t) for k, v in vals.items()},
                code=95
                if scenario in ("storm", "emergency")
                else 63
                if vals["rain_probability"] >= 60
                else (45 if scenario in ("fog", "hill_fog") else 2),
            )
        )
    # Current heat fixture intentionally meets the directive's 38 C / UV 9 test.
    current = points[0].model_copy(deep=True)
    for k in ("temperature", "uv"):
        current.metrics[k] = m(base[k], FIELDS[k][1], ref)
    current.metrics["feels_like"] = m(
        base["temperature"] + (3 if base["humidity"] >= 70 else 0), "°C", ref
    )
    days = []
    for day in range(7):
        t = ref + timedelta(days=day)
        days.append(
            DailyForecast(
                date=t.date().isoformat(),
                sunrise=t.replace(hour=5, minute=15),
                sunset=t.replace(hour=18, minute=55),
                metrics={
                    "high": m(base["temperature"], "°C", t),
                    "low": m(base["temperature"] - 5, "°C", t),
                    "rain_total": m(base["precipitation"] * 24, "mm", t),
                    "rain_probability": m(base["rain_probability"], "%", t),
                    "uv": m(base["uv"], "index", t),
                },
            )
        )
    current.metrics["soil_moisture"] = m(
        0.34 if scenario == "agriculture_rain" else 0.19, "m³/m³", ref
    )
    current.metrics["soil_moisture_root"] = m(
        0.29 if scenario == "agriculture_rain" else 0.23, "m³/m³", ref
    )
    return WeatherBundle(
        location=loc,
        current=current,
        hourly=points,
        daily=days,
        air_quality={
            "aqi": m(base["aqi"], "US AQI", ref),
            "pm25": m(85 if scenario == "air" else 15, "µg/m³", ref),
            "pm10": m(110 if scenario == "air" else 25, "µg/m³", ref),
            **(
                {
                    "grass_pollen": m(70, "grains/m³", ref),
                    "birch_pollen": m(15, "grains/m³", ref),
                    "alder_pollen": m(4, "grains/m³", ref),
                }
                if scenario == "pollen"
                else {}
            ),
        },
        marine=(
            {
                "wave_height": m(1.2, "m", ref),
                "wave_period": m(7, "s", ref),
                "water_temperature": m(27, "°C", ref),
            }
            if scenario == "coast"
            else {}
        ),
        official_warnings=[
            OfficialWarning(
                id="demo-official-warning",
                authority="IMD",
                title="SIMULATED official-warning workflow",
                message="Demonstration only: severe warning fixture. No actual IMD bulletin is connected. Review safety guidance and defer outdoor activity in this simulated scenario.",
                severity="severe",
                location=loc,
                issued_at=ref,
                start_time=ref,
                end_time=ref + timedelta(hours=6),
                source_url="https://mausam.imd.gov.in/",
                status="simulated",
            )
        ]
        if scenario == "official_warning"
        else [],
        status="simulated",
        retrieved_at=ref,
        reference_time=ref,
        source="Deterministic demo scenario",
        scenario=scenario,
        notices=[
            "Simulated conditions for demonstration on 15 June 2026.",
            "All displayed demo metrics and any warning fixture are simulated. No live official warnings or flight status are supplied.",
        ],
    )
