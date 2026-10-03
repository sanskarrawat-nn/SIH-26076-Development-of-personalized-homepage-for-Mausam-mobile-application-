import logging
from datetime import datetime, timezone
from math import isfinite

import httpx

from app.core.config import settings
from app.schemas.weather import DailyForecast, Location, Metric, WeatherBundle, WeatherPoint, now

log = logging.getLogger("mausam.providers")
FIELDS = {
    "temperature": ("temperature_2m", "°C"),
    "feels_like": ("apparent_temperature", "°C"),
    "humidity": ("relative_humidity_2m", "%"),
    "rain_probability": ("precipitation_probability", "%"),
    "precipitation": ("precipitation", "mm"),
    "wind": ("wind_speed_10m", "km/h"),
    "wind_gusts": ("wind_gusts_10m", "km/h"),
    "uv": ("uv_index", "index"),
    "visibility": ("visibility", "m"),
    "pressure": ("surface_pressure", "hPa"),
    "dew_point": ("dew_point_2m", "°C"),
    "wind_direction": ("wind_direction_10m", "°"),
}


def timestamp(v):
    return datetime.fromtimestamp(v, timezone.utc)


def metric(value, unit, source, retrieved, valid, loc):
    if value is not None and not isfinite(value):
        value = None
    return Metric(
        value=value,
        unit=unit,
        source=source,
        retrieved_at=retrieved,
        valid_at=valid,
        location=loc,
        status="estimated" if value is not None else "unavailable",
    )


async def request(url, params):
    start = now()
    try:
        async with httpx.AsyncClient(
            timeout=settings.provider_timeout,
            headers={"User-Agent": "MausamSetu/2.1 (weather planning prototype)"},
        ) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
    finally:
        log.info(
            "provider_call",
            extra={
                "provider": url.split("/")[2],
                "latency_ms": int((now() - start).total_seconds() * 1000),
            },
        )


class OpenMeteoWeather:
    def __init__(self, model="best_match"):
        self.model = model

    async def fetch(self, loc):
        data = await request(
            "https://api.open-meteo.com/v1/forecast",
            {
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "timezone": "auto",
                "timeformat": "unixtime",
                "models": self.model,
                "forecast_days": 7,
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
                "hourly": ",".join([v[0] for v in FIELDS.values()]) + ",weather_code",
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,sunrise,sunset",
            },
        )
        loc = Location(**{**loc.model_dump(), "timezone": data.get("timezone", loc.timezone)})
        retrieved = now()
        source = f"Open-Meteo / {self.model} (weather model)"
        current = data["current"]
        current_time = timestamp(current["time"])
        hourly = data["hourly"]
        times = hourly["time"]

        def at(key, i):
            values = hourly.get(key, [])
            return values[i] if i < len(values) else None

        points = [
            WeatherPoint(
                time=timestamp(t),
                code=at("weather_code", i),
                metrics={
                    k: metric(at(field, i), unit, source, retrieved, timestamp(t), loc)
                    for k, (field, unit) in FIELDS.items()
                },
            )
            for i, t in enumerate(times)
            if t >= current_time.timestamp() - 3600
        ]
        nearest = min(range(len(times)), key=lambda i: abs(times[i] - current_time.timestamp()))
        cur = WeatherPoint(
            time=current_time,
            code=current.get("weather_code"),
            metrics={
                k: metric(
                    current.get(field) if field in current else at(field, nearest),
                    unit,
                    source,
                    retrieved,
                    current_time if field in current else timestamp(times[nearest]),
                    loc,
                )
                for k, (field, unit) in FIELDS.items()
            },
        )
        if cur.metrics["temperature"].value is None:
            raise ValueError("Missing current temperature")
        daily = data["daily"]
        days = []

        def daily_time(field, index):
            values = daily.get(field) or []
            value = values[index] if index < len(values) else None
            return timestamp(value) if value is not None else None

        for i, t in enumerate(daily["time"]):
            day_metrics = {}
            for key, field, unit in [
                ("high", "temperature_2m_max", "°C"),
                ("low", "temperature_2m_min", "°C"),
                ("rain_total", "precipitation_sum", "mm"),
                ("rain_probability", "precipitation_probability_max", "%"),
                ("uv", "uv_index_max", "index"),
            ]:
                values = daily.get(field, [])
                day_metrics[key] = metric(
                    values[i] if i < len(values) else None,
                    unit,
                    source,
                    retrieved,
                    timestamp(t),
                    loc,
                )
            from zoneinfo import ZoneInfo

            days.append(
                DailyForecast(
                    date=timestamp(t).astimezone(ZoneInfo(loc.timezone)).date().isoformat(),
                    metrics=day_metrics,
                    sunrise=daily_time("sunrise", i),
                    sunset=daily_time("sunset", i),
                )
            )
        return WeatherBundle(
            location=loc,
            current=cur,
            hourly=points,
            daily=days,
            status="estimated",
            retrieved_at=retrieved,
            reference_time=retrieved,
            source=source,
            notices=["Forecast model estimates, not station observations."],
        )


class AirSnapshot(dict):
    """Current metric mapping plus hourly context from the SAME provider request."""

    def __init__(self, current, hourly):
        super().__init__(current)
        self.hourly = hourly


class OpenMeteoAir:
    async def fetch(self, loc):
        data = await request(
            "https://air-quality-api.open-meteo.com/v1/air-quality",
            {
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "current": "us_aqi,pm2_5,pm10",
                "hourly": "us_aqi",
                "timeformat": "unixtime",
            },
        )
        retrieved = now()
        current = data["current"]
        result = {
            key: metric(
                current.get(field),
                unit,
                "Open-Meteo / CAMS",
                retrieved,
                timestamp(current["time"]),
                loc,
            )
            for key, field, unit in [
                ("aqi", "us_aqi", "US AQI"),
                ("pm25", "pm2_5", "µg/m³"),
                ("pm10", "pm10", "µg/m³"),
            ]
        }
        # Pollen has European coverage only. A failure must not erase the AQI response.
        if 30 <= loc.latitude <= 72 and -25 <= loc.longitude <= 45:
            try:
                pollen = await request(
                    "https://air-quality-api.open-meteo.com/v1/air-quality",
                    {
                        "latitude": loc.latitude,
                        "longitude": loc.longitude,
                        "current": "grass_pollen,birch_pollen,alder_pollen",
                        "timeformat": "unixtime",
                        "domains": "cams_europe",
                    },
                )
                current_pollen = pollen["current"]
                for key in ["grass_pollen", "birch_pollen", "alder_pollen"]:
                    result[key] = metric(
                        current_pollen.get(key),
                        "grains/m³",
                        "CAMS Europe pollen model",
                        retrieved,
                        timestamp(current_pollen["time"]),
                        loc,
                    )
            except Exception:
                log.warning("pollen_unavailable")
        hourly = data.get("hourly", {})
        aqi_values = hourly.get("us_aqi", [])
        forecasts = {
            timestamp(stamp): metric(
                aqi_values[i],
                "US AQI",
                "Open-Meteo / CAMS hourly forecast",
                retrieved,
                timestamp(stamp),
                loc,
            )
            for i, stamp in enumerate(hourly.get("time", [])[:168])
            if i < len(aqi_values)
        }
        return AirSnapshot(result, forecasts)


class OpenMeteoMarine:
    async def fetch(self, loc):
        data = await request(
            "https://marine-api.open-meteo.com/v1/marine",
            {
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "current": "wave_height,wave_period,sea_surface_temperature",
                "timeformat": "unixtime",
                "cell_selection": "sea",
            },
        )
        # Do not imply offshore grid data describes inland locations.
        from math import cos, radians, sqrt

        distance = 111 * sqrt(
            (data["latitude"] - loc.latitude) ** 2
            + (cos(radians(loc.latitude)) * (data["longitude"] - loc.longitude)) ** 2
        )
        if distance > 30:
            raise ValueError("No nearby marine grid")
        retrieved = now()
        current = data["current"]
        return {
            key: metric(
                current.get(field),
                unit,
                "Open-Meteo / marine model",
                retrieved,
                timestamp(current["time"]),
                loc,
            )
            for key, field, unit in [
                ("wave_height", "wave_height", "m"),
                ("wave_period", "wave_period", "s"),
                ("water_temperature", "sea_surface_temperature", "°C"),
            ]
        }


class OpenMeteoLocations:
    async def search(self, query):
        data = await request(
            "https://geocoding-api.open-meteo.com/v1/search",
            {"name": query, "count": 8, "language": "en", "format": "json"},
        )
        return [
            Location(
                name=", ".join(filter(None, [v["name"], v.get("admin1")])),
                latitude=v["latitude"],
                longitude=v["longitude"],
                country=v.get("country", ""),
                timezone=v.get("timezone", "UTC"),
            )
            for v in data.get("results", [])
        ]


class OpenMeteoSoil:
    async def fetch(self, loc):
        data = await request(
            "https://api.open-meteo.com/v1/forecast",
            {
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "hourly": "soil_moisture_0_to_1cm,soil_moisture_3_to_9cm",
                "forecast_days": 1,
                "timeformat": "unixtime",
            },
        )
        hourly = data["hourly"]
        times = hourly["time"]
        retrieved = now()
        index = min(range(len(times)), key=lambda i: abs(times[i] - retrieved.timestamp()))
        return {
            key: metric(
                hourly.get(field, [])[index] if index < len(hourly.get(field, [])) else None,
                "m³/m³",
                "Open-Meteo model soil moisture",
                retrieved,
                timestamp(times[index]),
                loc,
            )
            for key, field in [
                ("soil_moisture", "soil_moisture_0_to_1cm"),
                ("soil_moisture_root", "soil_moisture_3_to_9cm"),
            ]
        }
