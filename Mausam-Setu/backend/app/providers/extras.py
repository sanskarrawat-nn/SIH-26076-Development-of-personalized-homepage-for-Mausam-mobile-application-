"""Optional services, requested explicitly. Credentials stay on the server."""

import asyncio
import time
from datetime import datetime, timedelta, timezone
from math import cos, radians, sqrt

from app.core.config import settings
from app.providers.open_meteo import request
from app.schemas.weather import now

_cache = {}


async def memo(key, loader, ttl=600):
    previous = _cache.get(key)
    if previous and time.monotonic() - previous[0] < ttl:
        return previous[1]
    result = await loader()
    if len(_cache) >= 128:
        _cache.clear()
    _cache[key] = (time.monotonic(), result)
    return result


def unavailable(message):
    return {"status": "unavailable", "message": message}


def distance(a, b, c, d):
    return 111 * sqrt((a - c) ** 2 + (cos(radians(a)) * (b - d)) ** 2)


async def tides(loc, day, mode):
    if mode == "demo":
        zone = __import__("zoneinfo").ZoneInfo(loc.timezone)
        start = datetime.combine(day, datetime.min.time(), tzinfo=zone)
        return {
            "status": "simulated",
            "source": "Demo tide timetable",
            "datum": "Demo reference only",
            "events": [
                {"time": (start + timedelta(hours=h)).isoformat(), "height": height, "type": kind}
                for h, height, kind in [
                    (3, 0.4, "Low"),
                    (9, 1.8, "High"),
                    (15, 0.5, "Low"),
                    (21, 1.7, "High"),
                ]
            ],
            "message": "Simulated tide events, not predictions for this coast.",
        }
    if not settings.worldtides_api_key:
        return unavailable("Tide service is not configured. High/low tide times are unavailable.")

    async def fetch():
        data = await request(
            "https://www.worldtides.info/api/v3",
            {
                "extremes": "",
                "date": day.isoformat(),
                "days": 1,
                "lat": loc.latitude,
                "lon": loc.longitude,
                "key": settings.worldtides_api_key,
            },
        )
        if data.get("status") != 200:
            raise ValueError("Tide provider rejected request")
        if distance(loc.latitude, loc.longitude, data["responseLat"], data["responseLon"]) > 30:
            raise ValueError("Tide grid too far away")
        events = [
            {
                "time": datetime.fromtimestamp(e["dt"], timezone.utc).isoformat(),
                "height": e["height"],
                "type": e["type"],
            }
            for e in data.get("extremes", [])
            if e.get("type") in ("High", "Low")
        ]
        if not events:
            return unavailable("No tide events returned for this location and date.")
        return {
            "status": "estimated",
            "source": "WorldTides",
            "retrieved_at": now().isoformat(),
            "datum": data.get("responseDatum", "Provider reference datum"),
            "events": events,
            "message": data.get("copyright", "WorldTides predictions. Not for navigation."),
        }

    # Do not share one licensed tide lookup across users.
    try:
        return await fetch()
    except Exception:
        return unavailable("Tide predictions could not be retrieved for this coast.")


async def traffic(origin, destination, departure, mode, transport="car"):
    if mode == "demo":
        return {
            "status": "simulated",
            "source": "Demo journey",
            "minutes": 35,
            "delay_minutes": 8,
            "km": 14,
            "message": "Simulated route totals and illustrative geometry; not a road route.",
            "geometry": [
                {
                    "latitude": origin.latitude + (destination.latitude - origin.latitude) * f,
                    "longitude": origin.longitude + (destination.longitude - origin.longitude) * f,
                }
                for f in [0, 0.25, 0.5, 0.75, 1]
            ],
        }
    if transport == "bus":
        return unavailable("Public-transit routing is not configured. Traffic data unavailable.")
    if not settings.tomtom_api_key:
        return unavailable(
            "Traffic service is not configured. Journey time and congestion are unavailable."
        )
    if departure < now():
        return unavailable("Traffic planning needs a future departure time.")

    async def fetch():
        coordinates = (
            f"{origin.latitude},{origin.longitude}:{destination.latitude},{destination.longitude}"
        )
        data = await request(
            f"https://api.tomtom.com/routing/1/calculateRoute/{coordinates}/json",
            {
                "key": settings.tomtom_api_key,
                "traffic": "true",
                "departAt": departure.isoformat(),
                "computeTravelTimeFor": "all",
                "routeType": "fastest",
                "travelMode": transport,
                "routeRepresentation": "polyline",
            },
        )
        route = data["routes"][0]
        summary = route["summary"]
        geometry = [point for leg in route.get("legs", []) for point in leg.get("points", [])]
        from app.services.route_weather import sample_route

        if geometry:
            sample_route(geometry)  # Reject malformed provider geometry.
        if not 0 < summary["travelTimeInSeconds"] <= 172800:
            raise ValueError("Unsupported route duration")
        return {
            "status": "estimated",
            "source": "TomTom routing",
            "retrieved_at": now().isoformat(),
            "minutes": round(summary["travelTimeInSeconds"] / 60),
            "delay_minutes": round(summary.get("trafficDelayInSeconds", 0) / 60),
            "km": round(summary["lengthInMeters"] / 1000, 1),
            "geometry": geometry,
            "message": "Provider route estimate. Intermediate weather uses approximate distance-proportional ETAs.",
        }

    try:
        return await memo(
            (
                "route",
                transport,
                origin.latitude,
                origin.longitude,
                destination.latitude,
                destination.longitude,
                departure.isoformat(),
            ),
            fetch,
            300,
        )
    except Exception:
        return unavailable("Traffic routing is unavailable for these places or this time.")


async def aviation(icao, loc, at, mode):
    if not icao:
        return unavailable("Enter an ICAO airport code to retrieve its METAR/TAF bulletin.")
    if mode == "demo":
        return unavailable(
            "Real aviation bulletins are disabled in Demo mode; use the simulated endpoint forecasts below."
        )

    async def fetch():
        results = await asyncio.gather(
            *[
                request(
                    f"https://aviationweather.gov/api/data/{kind}", {"ids": icao, "format": "json"}
                )
                for kind in ("metar", "taf")
            ],
            return_exceptions=True,
        )
        reports = []
        for kind, rows in zip(("METAR", "TAF"), results):
            if isinstance(rows, Exception) or not isinstance(rows, list):
                continue
            for row in rows:
                # Require station identity, fresh report and coordinate consistency.
                if row.get("icaoId") != icao or row.get("lat") is None or row.get("lon") is None:
                    continue
                if distance(loc.latitude, loc.longitude, row["lat"], row["lon"]) > 80:
                    continue
                if kind == "METAR":
                    stamp = row.get("obsTime")
                    if (
                        not isinstance(stamp, (int, float))
                        or not 0 <= now().timestamp() - stamp <= 7200
                    ):
                        continue
                    valid = datetime.fromtimestamp(stamp, timezone.utc).isoformat()
                else:
                    begin = row.get("validTimeFrom")
                    end = row.get("validTimeTo")
                    if (
                        not isinstance(begin, (int, float))
                        or not isinstance(end, (int, float))
                        or not begin <= at.timestamp() <= end
                    ):
                        continue
                    valid = f"{datetime.fromtimestamp(begin, timezone.utc).isoformat()} to {datetime.fromtimestamp(end, timezone.utc).isoformat()}"
                raw = row.get("rawOb") if kind == "METAR" else row.get("rawTAF")
                if raw:
                    reports.append({"type": kind, "text": raw, "valid": valid})
        return {
            "status": ("live" if any(r["type"] == "METAR" for r in reports) else "estimated")
            if reports
            else "unavailable",
            "source": "NOAA Aviation Weather Center",
            "reports": reports,
            "message": "METAR describes recent conditions; TAF is included only when it covers the selected time. No flight-delay or cancellation status is inferred."
            if reports
            else "No fresh, nearby airport reports covering these inputs were returned.",
        }

    try:
        return await memo(
            ("aviation", icao, loc.latitude, loc.longitude, at.isoformat()), fetch, 300
        )
    except Exception:
        return unavailable("Airport bulletins are temporarily unavailable.")
