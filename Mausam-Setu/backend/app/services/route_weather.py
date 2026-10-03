"""Bounded route screening. Distance-proportional ETAs are explicitly estimates."""

import asyncio
import math

from app.providers.extras import distance
from app.recommendations.planning import assessment, period
from app.schemas.weather import Location
from app.services.weather import service
from app.utils.time import add_hours


def sample_route(geometry, count=5):
    if not 2 <= len(geometry) <= 100000 or not 2 <= count <= 7:
        raise ValueError("Invalid route geometry or sample count")
    for p in geometry:
        if (
            not all(math.isfinite(p[k]) for k in ("latitude", "longitude"))
            or abs(p["latitude"]) > 90
            or abs(p["longitude"]) > 180
        ):
            raise ValueError("Invalid route coordinate")
    lengths = [0.0]
    for a, b in zip(geometry, geometry[1:]):
        lengths.append(
            lengths[-1] + distance(a["latitude"], a["longitude"], b["latitude"], b["longitude"])
        )
    if lengths[-1] <= 0:
        raise ValueError("Route has no length")
    samples = []
    index = 1
    for i in range(count):
        fraction = i / (count - 1)
        target = lengths[-1] * fraction
        while index < len(lengths) - 1 and lengths[index] < target:
            index += 1
        segment = lengths[index] - lengths[index - 1]
        part = (target - lengths[index - 1]) / segment if segment else 0
        samples.append(
            {
                k: geometry[index - 1][k] + (geometry[index][k] - geometry[index - 1][k]) * part
                for k in ("latitude", "longitude")
            }
            | {"fraction": fraction}
        )
    return samples


async def route_weather(plan, routing, departure):
    if not routing.get("geometry") or not routing.get("minutes"):
        return {
            "status": "unavailable",
            "samples": [],
            "message": "Route geometry unavailable; only endpoint forecasts can be screened.",
        }
    samples = sample_route(routing["geometry"])

    async def screen(sample):
        at = add_hours(departure, routing["minutes"] * sample["fraction"] / 60)
        loc = Location(
            name="Route sample",
            latitude=sample["latitude"],
            longitude=sample["longitude"],
            timezone=plan.origin.timezone,
        )
        bundle = await service.get(loc, plan.mode, plan.scenario)
        return {
            **sample,
            "at": at,
            "source": bundle.source,
            "status": bundle.status,
            **assessment(period(bundle, at, 1)),
        }

    return {
        "status": routing["status"],
        "samples": await asyncio.gather(*(screen(p) for p in samples)),
        "source": routing["source"],
        "geometry": routing["geometry"],
        "message": "Five samples only; hazards between samples may be missed. ETAs distribute total travel time by distance, not segment traffic. Hourly forecasts cannot resolve exact onset. Recheck before travel.",
    }
