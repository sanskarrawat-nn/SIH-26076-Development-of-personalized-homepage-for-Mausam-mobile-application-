import pytest
from fastapi.testclient import TestClient

from app.main import app, requests


@pytest.fixture
def client():
    requests.clear()
    with TestClient(app) as c:
        yield c


@pytest.mark.parametrize(
    "endpoint",
    [
        "/health",
        "/ready",
        "/api/config",
        "/api/home/personalized",
        "/api/weather/current",
        "/api/weather/hourly",
        "/api/weather/daily",
        "/api/air-quality",
        "/api/alerts",
        "/api/marine",
    ],
)
def test_api_contract(client, endpoint):
    response = client.get(endpoint, params={"mode": "demo", "scenario": "heat"})
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    if endpoint == "/api/home/personalized":
        home = response.json()
        assert {
            "current_weather",
            "today_for_you",
            "priority_alerts",
            "hourly",
            "daily",
            "personalized_sections",
            "data_status",
        } <= home.keys()
        m = home["current_weather"]["metrics"]["temperature"]
        assert {
            "value",
            "unit",
            "source",
            "retrieved_at",
            "valid_at",
            "location",
            "status",
        } <= m.keys()


@pytest.mark.parametrize(
    "params",
    [
        {"latitude": 91},
        {"longitude": -181},
        {"timezone": "Mars"},
        {"mode": "fake"},
        {"interests": "unknown"},
        {"scenario": "unknown"},
    ],
)
def test_invalid_query(client, params):
    assert (
        client.get("/api/home/personalized", params={"mode": "demo", **params}).status_code == 422
    )


def test_search_failure(client, monkeypatch):
    async def fail(*args):
        raise TimeoutError()

    monkeypatch.setattr("app.api.routes.OpenMeteoLocations.search", fail)
    assert client.get("/api/locations/search?q=Lucknow").status_code == 503


def test_cors(client):
    response = client.options(
        "/api/home/personalized",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    bad = client.options(
        "/api/home/personalized",
        headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in bad.headers


def test_rate_limit(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "rate_limit_per_minute", 2)
    assert client.get("/health").status_code == 200
    assert client.get("/health").status_code == 200
    assert client.get("/health").status_code == 429
