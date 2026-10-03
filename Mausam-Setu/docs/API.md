# API

Interactive OpenAPI contracts: `/docs`; machine schema: `/openapi.json`.

| GET endpoint | Response |
|---|---|
| `/health` | Liveness |
| `/ready` | Database readiness; 503 if unavailable |
| `/api/config` | Persona configuration, scenario names, reminder cooldown |
| `/api/home/personalized` | Normalized weather, ranked insights, advisories, forecast and status |
| `/api/weather/current` | Current weather point |
| `/api/weather/hourly` | Hourly weather points |
| `/api/weather/daily` | Daily forecasts |
| `/api/air-quality` | Named normalized AQI/particle metrics or empty object |
| `/api/marine?interests=marine` | Named marine metrics or empty object |
| `/api/alerts` | Expiring app-generated advisories |
| `/api/locations/search?q=Lucknow` | Locations; 503 when provider unavailable |

## Shared weather query parameters

`latitude` [-90,90], `longitude` [-180,180], `name`, IANA `timezone`, `mode=live|demo`, scenario key, comma-separated `interests`, and `activity`. Defaults: Lucknow, Asia/Kolkata, live-provider mode, pleasant fixture if demo, fitness+health. Units remain canonical in the API; the browser converts display units.

```text
/api/home/personalized?mode=demo&scenario=heat&interests=fitness,health
/api/home/personalized?mode=demo&scenario=agriculture_rain&interests=agriculture
```

The Home model contains `location`, `current_weather`, `today_for_you`, `priority_alerts`, `hourly`, `daily`, `personalized_sections`, `air_quality`, `marine`, `data_status`, `generated_at` and `reference_time`.

Every metric contains `value`, `unit`, `source`, `retrieved_at`, `valid_at`, `location`, `status`. Missing values are null/unavailable or absent, never zero-filled. Recommendation priority is a ranking score, not weather confidence. `quality` expresses data coverage limitations, not a calibrated forecast probability.

Unknown personas/scenarios, bad coordinates and invalid timezones return 422. Rate limits return 429 with Retry-After. Optional provider failure preserves the homepage. Total weather failure uses a valid cached provider response or an unavailable Home. Demo data is only returned for an explicit demo request. No authenticated personal-data endpoints exist.

## Planning extensions (1.1)

`GET /api/home/personalized` accepts an optional URL-encoded `planning` JSON object, validated by the `Planning` schema. Existing clients can omit it. Response adds `planning` with requested fitness, school, event and planting assessments.

`POST /api/planner/journey` accepts origin/destination Location objects, departure/arrival ISO date-times, kind (`commute`, `school`, `flight`), mode and scenario, and optional ICAO codes. Naive times use their endpoint's timezone; aware times retain their supplied offset. Response contains endpoint assessments, optional traffic or airport data, and coverage limitations.

`POST /api/planner/tides` accepts location, day (`YYYY-MM-DD`) and mode. Unconfigured or failed optional services return explicit unavailable results, never invented zeros. Demo mode never calls paid providers.
