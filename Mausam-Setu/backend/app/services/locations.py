"""User-triggered place searches, with a small cache and serialized provider calls."""

import asyncio
import time

import httpx

from app.core.config import settings
from app.schemas.weather import Location


class LocationService:
    def __init__(self):
        self.lock = asyncio.Lock()
        self.last_request = 0.0
        self.cache = {}

    async def request(self, endpoint, params):
        key = (endpoint, tuple(sorted(params.items())))
        async with self.lock:
            saved = self.cache.get(key)
            if saved and time.monotonic() - saved[0] < 86400:
                return saved[1]
            delay = 1.1 - (time.monotonic() - self.last_request)
            if delay > 0:
                await asyncio.sleep(delay)
            self.last_request = time.monotonic()
            async with httpx.AsyncClient(timeout=settings.provider_timeout) as client:
                response = await client.get(
                    settings.geocoder_url.rstrip("/") + endpoint,
                    params=params,
                    headers={
                        "User-Agent": "MausamSetu/2.1 (user initiated weather location lookup)"
                    },
                )
                response.raise_for_status()
                data = response.json()
            if len(self.cache) >= 300:
                self.cache.pop(next(iter(self.cache)))
            self.cache[key] = (time.monotonic(), data)
            return data

    def location(self, feature, fallback_zone="UTC"):
        properties = feature["properties"]
        longitude, latitude = feature["geometry"]["coordinates"][:2]
        country_code = properties.get("countrycode", "").upper()
        parts = [
            properties.get(field) for field in ("name", "city", "district", "state", "postcode")
        ]
        name = ", ".join(dict.fromkeys(str(part) for part in parts if part))
        return Location(
            name=(name or "Selected place")[:120],
            latitude=latitude,
            longitude=longitude,
            country=properties.get("country", "")[:80],
            timezone="Asia/Kolkata" if country_code == "IN" else fallback_zone,
        )

    async def search(self, query):
        data = await self.request(
            "/api/", {"q": query.strip() + " India", "limit": 10, "lang": "en"}
        )
        results = {}
        for feature in data.get("features", []):
            if feature.get("properties", {}).get("countrycode", "").upper() != "IN":
                continue
            try:
                location = self.location(feature)
                key = (location.latitude, location.longitude, location.name)
                results[key] = location
            except (KeyError, ValueError, TypeError):
                continue
        return list(results.values())

    async def reverse(self, location):
        try:
            data = await self.request(
                "/reverse",
                {"lat": location.latitude, "lon": location.longitude, "limit": 1, "lang": "en"},
            )
            features = data.get("features", [])
            if features:
                named = self.location(features[0], location.timezone)
                # Keep the user's rounded GPS coordinate, not the nearest POI coordinate.
                return named.model_copy(
                    update={"latitude": location.latitude, "longitude": location.longitude}
                )
        except (httpx.HTTPError, KeyError, ValueError, TypeError):
            pass
        return location


location_service = LocationService()
