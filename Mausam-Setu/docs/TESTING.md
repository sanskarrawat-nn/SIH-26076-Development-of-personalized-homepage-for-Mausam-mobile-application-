# Current release

See [Part 3 verification](PART3-TEST-RESULTS.md) for the final build. The records below describe earlier releases.

# Verification report

Verified in the provided Linux execution environment on 26 September 2026 (combined edition).

| Check | Result |
|---|---|
| Backend unit, API, personalization, service and normalization tests | **91 passed** |
| Frontend unit, offline, map and category tests | **7 passed** |
| Original browser journey checks | **9 passed; no uncaught page errors** |
| New planning browser checks | **7 passed; no uncaught page errors** |
| Combined map, inbox, location and mode browser checks | **6 passed; no uncaught page errors** |
| Production offline checks | **4 passed** |
| Frontend formatting check | Passed |
| Production Vite build and offline precache generation | Passed |
| Desktop rendering | Inspected screenshots |
| 390 × 844 mobile viewport | Inspected; no document horizontal overflow |
| 200% base text size at 780px | No document horizontal overflow |
| Online providers | Weather, air, soil, marine, European pollen and Lucknow METAR retrieved successfully; see JSON evidence |
| Public deployment | Not performed; account/repository required |

Backend tests cover all eight personas, high-temperature warning, travel rain packing, family rain checks, 18 mm agricultural rainfall, low visibility, elevated AQI, marine unavailability, multi-interest grouping, deterministic scenario statuses, bounded scores, expired advice, no-data behavior, activity ranking, daylight/missing-input window screening, rainfall completeness, primary/secondary provider fallback, optional-provider failure, fresh/stale/expired cache, concurrent request deduplication, typed endpoints, validation, CORS, rate limit, partial weather normalization, malformed provider responses and inland marine rejection.

Browser checks exercised all five onboarding steps, Judge Mode, interest changes, explanation scores, umbrella packing, agricultural rainfall, missing data, saving a city, unit conversion, source details, advisory dialog, daily forecast, mobile layout and text enlargement. Screenshots and machine-readable results are in `docs/qa/`. Screenshot backdrops/fixed bars can appear partway down a full-page capture because they are positioned relative to the viewport; the interactive dialogs and bottom navigation are viewport-fixed.

Production offline checks loaded and cached the built shell, reloaded without network, verified the data label, changed interests and verified mismatched data was not reused, then restored network and confirmed recovery.

## Run again

```bash
cd backend
pip install -r requirements-dev.txt
ruff check app
ruff format --check app
python -m pytest -q
python -m compileall -q app
```

```bash
cd frontend
npm ci
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:planning
npm run test:merge
```

The browser script starts its own API/Vite processes. Activate the backend Python environment first, or set `TEST_PYTHON` to that environment's Python executable. `CHROMIUM_PATH` optionally points to an installed Chromium executable. Avoid running other services on the same 8000/5173 ports while testing. The test browser uses headless Chromium; physical iPhone/Safari testing remains outstanding.

## Remaining evidence limits

- Online adapter requests for weather, air, soil, marine, European pollen and a Lucknow METAR succeeded in this environment with a 25-second test timeout. Actual deployed reliability remains unverified. Traffic/tides lack credentialed end-to-end tests; fixture contracts and demo flows passed. The IMD district-warning endpoint returned HTTP 401.
- No production load test, security penetration test, external accessibility audit, PostgreSQL-hosted deployment test or scientific calibration study was performed.
- The Windows launcher is supplied but was not executed on a Windows host here. Equivalent Linux startup/API/frontend flows were exercised.
- A dependency emits a non-failing Starlette/AnyIO deprecation warning in backend tests. It is recorded rather than suppressed. The test suite passes with the exact locked requirements.
- Health and activity thresholds are demonstration screening policies, not certified medical or environmental-safety models.

## 1.1 coverage

New tests cover complete interval coverage, missing hours, past/out-of-horizon events, user school times, activity duration/intensity, comfort/rain separation, advance frost/storm advisories, sensitivity preferences, crop/region and sowing-date boundaries, expired plan suppression, timezone-aware journeys, missing credentials, traffic response normalization, tide datum/attribution and proximity rejection, TAF validity/station checks, stale airport data, pollen failure isolation, soil-depth normalization, malformed settings, and POST CORS.

The planning browser checks exercise every new form family, saved preferences, endpoint forecasts, missing aviation data, explicit tide/traffic demos, stale-result clearing, and expanded layouts at 390px width with 200% text. Physical phone and Safari checks remain outstanding.

## 1.2 coverage

Regression checks include cancelled shared requests, cache I/O failures, nearby-coordinate cache isolation, timezone differences, daylight-saving gaps and overlaps, corrupted saved preferences, nonfinite metrics, short sunrise/sunset arrays, snow-shower labels, and preservation of unsaved planning inputs during a background refresh.

## Combined 2.0 coverage

The merge tests cover seven map URL configurations, imperial units, offline/reconnect map state, persistent advisory read-state, detailed place selection, selected-location clock and strict provider-mode requests. Browser map and place-search responses are stubbed to make UI behavior deterministic; these checks do not certify external iframe rendering or worldwide layer coverage.

Live Photon lookup returned Hazratganj results and a reverse place name. A PIN-code lookup initially timed out; a retry with a 25-second test timeout returned 226001 results. Live Open-Meteo returned surface pressure, dew point and wind direction with provenance. Evidence: `qa/merged-geocoder.json` and `qa/merge-live-checks.json`. External availability remains variable.

The latest uploaded ZIP, `mausam-personal_ajay(1).zip`, had the same non-build-cache file contents as `mausam-personal_ajay.zip`.
