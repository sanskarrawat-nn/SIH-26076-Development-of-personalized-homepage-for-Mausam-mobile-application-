"""Transport-neutral notification policy for a future scheduled push worker.

Deployments must supply a durable receipt store and a sender (Web Push VAPID or
Android FCM). The shipped browser handles foreground checks independently.
"""

from datetime import datetime, timedelta
from typing import Literal, Protocol

from pydantic import AwareDatetime, BaseModel, Field


class Candidate(BaseModel):
    id: str = Field(min_length=1, max_length=160)
    category: Literal["official", "school", "fitness", "commute", "event", "journey", "student"]
    severity: Literal["info", "caution", "warning", "severe"]
    status: Literal["live", "estimated", "cached", "simulated", "unavailable"]
    expires_at: AwareDatetime
    title: str = Field(max_length=100)
    message: str = Field(max_length=500)


class NotificationPreferences(BaseModel):
    enabled: bool = False
    categories: list[str] = Field(default_factory=lambda: ["official"], max_length=7)
    severity: Literal["info", "caution", "warning", "severe"] = "caution"
    cooldown_minutes: int = Field(default=60, ge=15, le=1440)


def eligible(
    candidate: Candidate,
    preferences: NotificationPreferences,
    last_sent: datetime | None,
    at: datetime,
):
    levels = {"info": 0, "caution": 1, "warning": 2, "severe": 3}
    return (
        preferences.enabled
        and candidate.category in preferences.categories
        and candidate.status in ("live", "estimated")
        and candidate.expires_at > at
        and levels[candidate.severity] >= levels[preferences.severity]
        and (last_sent is None or at - last_sent >= timedelta(minutes=preferences.cooldown_minutes))
    )


class PushTransport(Protocol):
    async def send(self, subscription: dict, candidate: Candidate) -> bool:
        """Return success only after provider accepts; remove expired subscriptions."""
        ...
