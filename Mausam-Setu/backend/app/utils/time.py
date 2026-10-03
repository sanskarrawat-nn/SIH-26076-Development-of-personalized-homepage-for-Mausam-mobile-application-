"""Keep elapsed durations separate from local clock times."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


def utc(timestamp: datetime) -> datetime:
    return timestamp.astimezone(timezone.utc)


def add_hours(timestamp: datetime, hours: float) -> datetime:
    return (utc(timestamp) + timedelta(hours=hours)).astimezone(timestamp.tzinfo)


def resolve_local_time(timestamp: datetime, zone_name: str) -> datetime:
    if timestamp.tzinfo is not None:
        return timestamp
    zone = ZoneInfo(zone_name)
    first = timestamp.replace(tzinfo=zone, fold=0)
    second = timestamp.replace(tzinfo=zone, fold=1)
    if utc(first).astimezone(zone).replace(tzinfo=None) != timestamp:
        raise ValueError("This local time does not exist because the clocks change.")
    if first.utcoffset() != second.utcoffset():
        raise ValueError(
            "This local time occurs twice. Choose another time or supply an explicit UTC offset."
        )
    return first
