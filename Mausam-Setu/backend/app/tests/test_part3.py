from datetime import timedelta

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.api.routes import integration_context
from app.core.body_limit import BodyLimitMiddleware
from app.main import app, report_requests, requests
from app.personalization.engine import compose
from app.providers.demo import fixture
from app.schemas.weather import Location, Profile
from app.services import community
from app.tests.test_part2 import payload, reports  # noqa: F401


@pytest.fixture
def client():
    requests.clear()
    report_requests.clear()
    with TestClient(app) as client:
        yield client


def test_native_contract_and_persona_switches(client):
    results = []
    for persona in ["fitness,health", "agriculture", "travel", "student", "family"]:
        response = client.get(
            "/api/integration/v1/context",
            params={"mode": "demo", "scenario": "heat", "interests": persona},
        )
        assert response.status_code == 200
        data = response.json()
        assert {
            "user_context",
            "weather",
            "weather_risk",
            "official_alerts",
            "homepage_layout",
            "recommendations",
            "community_conditions",
            "data_sources",
            "generated_at",
        } <= data.keys()
        assert data["schema_version"] == "1.0"
        assert data["community_conditions"] == []
        assert data["weather"]["data_status"]["status"] == "simulated"
        assert all(
            {
                "widget_id",
                "widget_type",
                "priority",
                "reason",
                "actions",
                "source",
                "status",
                "expires_at",
            }
            <= w.keys()
            for w in data["homepage_layout"]
        )
        results.append(data)
    assert len({str(d["weather"]["current"]) for d in results}) == 1
    assert len({str(d["weather_risk"]) for d in results}) == 1
    assert len({str(d["recommendations"]) for d in results}) == 5
    for data, key in zip(
        [results[0], results[1], results[3], results[4]],
        ["fitness", "planting", "student", "school"],
    ):
        assert key in data["planning"]


def test_official_demo_is_simulated_and_overrides_learning(client):
    response = client.get(
        "/api/integration/v1/context",
        params={"mode": "demo", "scenario": "official_warning", "learned_weights": '{"fitness":0}'},
    )
    data = response.json()
    assert data["safety"]["emergency"] is True
    assert data["homepage_layout"][0]["widget_id"] == "safety"
    assert data["official_alerts"][0]["status"] == "simulated"
    assert "SIMULATED" in data["official_alerts"][0]["title"]


def test_tomorrow_morning_uses_requested_day_and_duration():
    bundle = fixture(Location(name="Lucknow", latitude=26.85, longitude=80.95))
    home = compose(bundle, Profile(interests=["fitness"]))
    session = home.planning["fitness_tomorrow_morning"]
    assert session["available"]
    assert session["start"].date() == bundle.reference_time.date() + timedelta(days=1)
    assert 5 <= session["start"].hour < session["end"].hour <= 12
    assert session["end"] - session["start"] == timedelta(minutes=60)


@pytest.mark.asyncio
@pytest.mark.usefixtures("reports")
async def test_duplicate_rejection_before_new_record():
    first = await community.create_report(payload(description="  Water at crossing "))
    with pytest.raises(HTTPException) as error:
        await community.create_report(payload(description="water   at crossing"))
    assert error.value.status_code == 409
    assert len(community.list_reports(26.85, 80.95)["reports"]) == 1
    assert first["delete_token"]


def test_storage_failure_is_recoverable_without_trace(client, monkeypatch):
    def fail():
        raise OperationalError("secret query", {}, Exception("private connection string"))

    monkeypatch.setattr(community, "active_rows", fail)
    response = client.get("/api/community/reports?latitude=26&longitude=80")
    assert response.status_code == 503
    assert response.headers["retry-after"] == "30"
    assert "secret" not in response.text and "private" not in response.text


@pytest.mark.asyncio
async def test_native_weather_survives_community_storage_failure(monkeypatch):
    bundle = fixture(Location(name="Lucknow", latitude=26.85, longitude=80.95)).model_copy(
        update={"status": "estimated", "scenario": None}
    )

    def fail(*args):
        raise OperationalError("query", {}, Exception())

    monkeypatch.setattr(community, "list_reports", fail)
    data = await integration_context((bundle, Profile()))
    assert data["community_status"]["status"] == "unavailable"
    assert data["weather"]["current"].metrics["temperature"].value is not None


@pytest.mark.asyncio
async def test_chunked_body_is_bounded_before_application():
    called, sent = [], []

    async def app(scope, receive, send):
        called.append(True)

    chunks = iter(
        [
            {"type": "http.request", "body": b"x" * 6, "more_body": True},
            {"type": "http.request", "body": b"x" * 6, "more_body": False},
        ]
    )

    async def receive():
        return next(chunks)

    async def send(message):
        sent.append(message)

    await BodyLimitMiddleware(app, limit=10)({"type": "http", "method": "POST"}, receive, send)
    assert not called
    assert sent[0]["status"] == 413


def test_report_specific_limit_without_provider_requests(client):
    for _ in range(5):
        assert client.post("/api/community/reports", json={}).status_code == 422
    response = client.post("/api/community/reports", json={})
    assert response.status_code == 429
    assert response.headers["retry-after"] == "600"
