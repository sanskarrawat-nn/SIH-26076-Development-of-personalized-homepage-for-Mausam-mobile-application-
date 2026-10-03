"""Fetch weather once per location and keep optional services independent."""

import asyncio
import logging
from collections.abc import Iterable

from app.core.config import settings
from app.database.store import get_snapshot, put_snapshot
from app.providers.base import AirQualityProvider, WeatherProvider
from app.providers.demo import fixture
from app.providers.india import ADAPTERS
from app.providers.open_meteo import (
    OpenMeteoAir,
    OpenMeteoMarine,
    OpenMeteoSoil,
    OpenMeteoWeather,
)
from app.schemas.weather import Location, Metric, WeatherBundle, WeatherPoint, now

logger = logging.getLogger("mausam.weather")


def metric_groups(bundle: WeatherBundle) -> Iterable[dict[str, Metric]]:
    yield bundle.current.metrics
    yield bundle.air_quality
    yield bundle.marine
    for point in bundle.hourly:
        yield point.metrics
    for day in bundle.daily:
        yield day.metrics


def cached(bundle: WeatherBundle) -> WeatherBundle:
    """Copy before changing status; never mutate a shared provider response."""
    result = bundle.model_copy(deep=True)
    result.status = "cached"
    result.reference_time = now()
    notice = "Using a saved provider response. Check its retrieval time."
    if notice not in result.notices:
        result.notices.append(notice)

    for metrics in metric_groups(result):
        for metric in metrics.values():
            if metric.value is not None and metric.status != "unavailable":
                metric.status = "cached"
                metric.quality = "low"
    return result


def snapshot_age(bundle: WeatherBundle | None) -> float:
    if bundle is None:
        return float("inf")
    age = (now() - bundle.retrieved_at).total_seconds()
    # A future timestamp should not make a broken snapshot look permanently fresh.
    return age if age >= 0 else float("inf")


def cache_key(location: Location, include_marine: bool) -> str:
    return f"{location.latitude:.6f}:{location.longitude:.6f}:{location.timezone}:{include_marine}"


def with_location_name(bundle: WeatherBundle, requested: Location) -> WeatherBundle:
    """Retain the provider timezone, but use the caller's place label consistently."""
    result = bundle.model_copy(deep=True)
    location = result.location.model_copy(
        update={"name": requested.name, "country": requested.country}
    )
    result.location = location
    for metrics in metric_groups(result):
        for metric in metrics.values():
            metric.location = location.model_copy()
    return result


class WeatherService:
    def __init__(
        self,
        providers: list[WeatherProvider] | None = None,
        air: AirQualityProvider | None = None,
        marine: AirQualityProvider | None = None,
        soil: AirQualityProvider | None = None,
        official_providers=None,
    ):
        self.providers = (
            providers
            if providers is not None
            else [
                OpenMeteoWeather(),
                OpenMeteoWeather("gfs_seamless"),
            ]
        )
        self.air = air if air is not None else OpenMeteoAir()
        self.marine = marine if marine is not None else OpenMeteoMarine()
        self.soil = soil if soil is not None else OpenMeteoSoil()
        self.official_providers = official_providers if official_providers is not None else ADAPTERS
        self.pending: dict[str, asyncio.Task] = {}

    async def get(
        self,
        location: Location,
        mode: str = "live",
        scenario: str = "pleasant",
        include_marine: bool = False,
    ) -> WeatherBundle:
        if mode == "demo":
            return fixture(location, scenario)

        key = cache_key(location, include_marine) + (":strict" if mode == "live_only" else "")
        previous = await self._read_cache(key)
        if previous and snapshot_age(previous) < settings.cache_fresh_seconds:
            return with_location_name(cached(previous), location)

        task = self.pending.get(key)
        if task is None:
            task = asyncio.create_task(self._fetch(location, previous, key, include_marine))
            self.pending[key] = task
            task.add_done_callback(lambda finished: self._forget_request(key, finished))

        # Closing one tab must not cancel the shared fetch for another caller.
        bundle = await asyncio.shield(task)
        return with_location_name(bundle, location)

    def _forget_request(self, key: str, task: asyncio.Task) -> None:
        if self.pending.get(key) is task:
            self.pending.pop(key, None)
        if not task.cancelled():
            task.exception()  # Consume errors even if every waiting client disconnected.

    async def _read_cache(self, key: str) -> WeatherBundle | None:
        try:
            payload = await asyncio.to_thread(get_snapshot, key)
            if payload is None:
                return None
            bundle = WeatherBundle.model_validate(payload)
            if bundle.status not in ("estimated", "live", "cached"):
                return None
            return bundle
        except Exception as error:
            logger.warning("cache_read_failed", extra={"error_type": type(error).__name__})
            return None

    async def _write_cache(self, key: str, bundle: WeatherBundle) -> None:
        try:
            await asyncio.to_thread(put_snapshot, key, bundle.model_dump(mode="json"))
        except Exception as error:
            logger.warning("cache_write_failed", extra={"error_type": type(error).__name__})
            bundle.notices.append("Weather loaded, but the server cache could not be updated.")

    async def _weather(self, location: Location) -> WeatherBundle | None:
        for provider in self.providers:
            try:
                return await provider.fetch(location)
            except Exception as error:
                logger.warning("provider_failure", extra={"error_type": type(error).__name__})
        return None

    async def _optional_metrics(
        self, provider: AirQualityProvider, location: Location
    ) -> dict[str, Metric]:
        try:
            return await provider.fetch(location)
        except Exception as error:
            logger.warning("optional_provider_failure", extra={"error_type": type(error).__name__})
            return {}

    async def _fetch(
        self,
        location: Location,
        previous: WeatherBundle | None,
        key: str,
        include_marine: bool,
    ) -> WeatherBundle:
        requests = [
            self._weather(location),
            self._optional_metrics(self.air, location),
            self._optional_metrics(self.soil, location),
        ]
        if include_marine:
            requests.append(self._optional_metrics(self.marine, location))
        results = await asyncio.gather(*requests)
        bundle, air_quality, soil_metrics = results[:3]

        if bundle is not None:
            bundle.air_quality = air_quality
            air_hourly = getattr(air_quality, "hourly", {})
            for point in bundle.hourly:
                if point.time in air_hourly:
                    point.metrics["aqi"] = air_hourly[point.time]
            bundle.current.metrics.update(soil_metrics)
            bundle.marine = results[3] if include_marine else {}
            bundle.notices.append(
                "Official warnings are not connected. Pollen coverage is European only. "
                "Tide and traffic availability is checked in the planner."
            )
            if not air_quality:
                bundle.notices.append(
                    "Air quality unavailable; exposure and activity guidance is limited."
                )
            await self._attach_official(bundle)
            await self._write_cache(key, bundle)
            return bundle

        if previous and snapshot_age(previous) <= settings.cache_max_seconds:
            return cached(previous)

        timestamp = now()
        unavailable = WeatherBundle(
            location=location,
            current=WeatherPoint(time=timestamp),
            status="unavailable",
            retrieved_at=timestamp,
            reference_time=timestamp,
            source="None",
            notices=["Weather providers unavailable."],
        )
        await self._attach_official(unavailable)
        return unavailable

    async def _attach_official(self, bundle):
        # These adapters are inactive until an authorized loader is registered.
        for provider in self.official_providers:
            if provider.loader is None:
                continue
            try:
                result = await provider.fetch(bundle.location)
                bundle.official_warnings.extend(result.warnings)
                if provider.authority == "CPCB":
                    bundle.air_quality.update(result.metrics)
                elif provider.authority == "INCOIS":
                    bundle.marine.update(result.metrics)
                elif provider.authority == "IMD":
                    bundle.current.metrics.update(result.metrics)
                bundle.notices.extend(result.notices)
            except Exception as error:
                logger.warning(
                    "official_provider_failure", extra={"error_type": type(error).__name__}
                )


service = WeatherService()
