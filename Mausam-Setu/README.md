# Mausam Setu · 3.0

**One Forecast. Different Users. Better Decisions.**

Mausam Setu turns weather into decisions for a person's interests, location, schedule and activity. It implements a personalized homepage for the supplied **SIH26076 — Development of personalized homepage for “Mausam” mobile application** problem. It is an independent prototype, not an official IMD application or an integration already deployed inside Mausam.

## Technology and environment

React 18 + Vite frontend; Python FastAPI + Pydantic backend; SQLAlchemy with local SQLite or hosted PostgreSQL; pytest, Ruff and Playwright verification.

Local setup uses the defaults in `backend/.env.example` and `frontend/.env.example`. For deployment, set backend `DATABASE_URL` and `CORS_ORIGINS`, and frontend `VITE_API_BASE_URL` to the backend HTTPS origin before building. Keep `VITE_ENABLE_JUDGE_MODE=true` for SIH. Optional backend `TOMTOM_API_KEY`, `WORLDTIDES_API_KEY` and `COMMUNITY_REVIEW_TOKEN` remain blank unless configured; no keys are required for demo fixtures. `CPCB_DATA_GOV_API_KEY` is reserved and does not enable a live CPCB integration. Never put credentials in `VITE_*` variables.

## Start on Windows

Install Python 3.12 and Node.js 22 or later with PATH enabled. Extract the complete `Mausam-Setu` folder, open it in Antigravity if desired, and double-click `start-windows.bat`. Keep both server terminals open and visit `http://localhost:5173`. First launch installs dependencies; later launches reuse them. This final build was tested with Python 3.12 and Node 24 in Linux; Windows scripts are supplied but were not executed on Windows here.

Manual startup, in separate terminals:

```bat
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --port 8000 --no-access-log
```

```bat
cd frontend
npm ci
npm run dev
```

On Linux/macOS run `bash start.sh`. Local API documentation: `http://localhost:8000/docs`. No keys are needed for Judge Mode. Public-provider mode needs network access; optional paid adapters need backend credentials.

## What is connected

| Area | Implemented behavior |
| --- | --- |
| Personalization | Ten personas, combined interests, manual weights, current activity, schedule and bounded device feedback; actual section order changes |
| Safety | Expiring six-hour heuristic risk index, separate critical overrides, official-warning validation boundary; safety cannot be hidden by learned preferences |
| Plans | Fitness duration/daylight/intensity screening, school and student windows, commute, events, crop guidance, family play, coastal screening and five saved device plans |
| Weather | Open-Meteo current/hourly/daily models, CAMS US AQI, near-surface/root-zone soil moisture, regional pollen and screened marine grids |
| Travel | Origin/destination weather; five distance-proportional ETA samples when traffic route geometry is available; optional TomTom and WorldTides; NOAA METAR/TAF |
| Community | Coarse reports with expiry, private text/photo review, sanitized images, confidence checklist, local reviewer state and receipt-based deletion |
| Adaptive preferences | Explainability opens and Useful/Not Useful feedback adjust bounded persona/time weights on this device; reset/disable available |
| Experience | EN/HI controls, typed/voice questions, accessibility switches, weather map auto-loading after intentional opening, low-data mode and offline shell/cache |
| Notifications | Opt-in foreground PWA notifications with expiry, categories and cooldown; background delivery infrastructure is not connected |
| Integration | Renderer-independent `GET /api/integration/v1/context` plus existing web-compatible APIs |

The core answer is: **“What does this weather mean for me, and what should I do?”**

## How it works

Provider adapters normalize metrics with source, units, coordinates, retrieval time, validity, expiry and status. One weather bundle feeds independent safety and persona rules. Context, weather, time, severity, activity and freshness determine relevance; bounded learned preference contributions can alter relevance but never safety. The layout builder returns widget metadata; React or a future native renderer displays ordered sections and actions. Community evidence stays separate from official warnings and the numeric risk index.

Open-Meteo's primary model attempt falls back to its GFS model, then valid stored cache, then unavailable. These are two models from one provider, not independent weather services. Demo scenarios are explicit fixtures and never an automatic outage fallback.

See [architecture and native contract](docs/INTEGRATION.md), [provider matrix](docs/PROVIDER-MATRIX.md), [privacy](docs/PRIVACY.md), and [security](docs/SECURITY.md).

## SIH demonstration

Enable Judge Mode and follow its six buttons: Fitness + Health → Agriculture → Student → Family → Emergency Override → Hindi Ask Mausam. Each step selects a deterministic scenario and persona; the clock shows that scenario’s simulated date/time. Extreme heat offers a lower-risk morning window; “Extreme heat: no outdoor window” demonstrates honest refusal. To compare personalization under identical conditions, keep one scenario selected and change only the interest buttons, then open “Why this for me?”. Also show Official Warning (SIMULATED), Community Flood Report and No available data. In Hindi Ask Mausam, ask **“Kal morning running ke liye best time kya hai?”**. Open Weather Map to show automatic loading; its external layers are independent of demo weather. Finish with an offline/reconnect demonstration after warming the production build.

Detailed steps and technical questions: [SIH readiness](docs/SIH-READINESS.md).

## Limits that remain explicit

- IMD, CPCB, INCOIS, ICAR and NDMA adapters define a validated integration boundary; authorized loaders and provider mapping remain unconfigured. Official Warning Judge Mode uses a **simulated** fixture.
- No trained ML model, medical diagnosis, validated landslide model, navigation guarantee, irrigation dosage or flight-status prediction is claimed.
- US AQI is not Indian NAQI. India pollen coverage is unavailable. Tide predictions and gridded weather are estimates.
- Community verification requires a project reviewer and does not mean government verification. The report map is an approximate local diagram, not a GIS/Windy marker overlay.
- Native API readiness is not an APK, native app implementation, official authorization or deployed Mausam integration.
- Closed-app push requires a subscription service, VAPID sender and scheduled jobs. Current consent-based notifications run while the app is open.
- Core Hindi controls and principal guidance are translated; raw provider bulletins and technical rule identifiers remain verbatim. Human linguistic review and real screen-reader/device testing are still needed.
- No accounts, cloud profile sync, public deployment or paid credentials are bundled. Process-local throttling is not distributed abuse protection.

## Verification and deployment

See [final report](docs/PART3-COMPLETION.md), [test evidence](docs/PART3-TEST-RESULTS.md), [before/after UI review](docs/UI-COMPARISON.md), [deployment](docs/DEPLOYMENT.md), and [database upgrade procedure](docs/DATABASE.md). Part 1/2 reports remain historical records. The Part 3 report and this README describe the current version.

```sh
# backend directory, after installing requirements-dev.txt
python -m pytest -q app/tests
ruff check app
ruff format --check app
# frontend directory
npm ci
npm test
npm run format:check
npm run build
npx playwright install chromium
npm run test:browser
npm run test:planning
npm run test:merge
npm run test:part1
npm run test:part2
npm run test:part3
npm run test:offline
```

Set `TEST_PYTHON` if browser tests need a specific virtual environment; set `CHROMIUM_PATH` only for a separately installed Chromium. Run browser suites sharing a port sequentially. Provider transport is controlled in browser tests; this is not evidence of paid API access or real OS push delivery.

## Project map

| Path | Responsibility |
| --- | --- |
| `backend/app/api` | Validated query and planner routes; native contract |
| `backend/app/providers`, `services` | Provider I/O, caches, community, route samples |
| `backend/app/personalization`, `recommendations` | Shared rule engine, section ordering and schedule screening |
| `backend/app/safety` | Deterministic risk and independent safety overrides |
| `backend/app/database` | SQLAlchemy snapshot storage; community table registered by service import |
| `frontend/src` | React UI, device state, language catalogues, bounded voice intents |
| `frontend/public`, `scripts` | PWA shell, local font, build-time asset precache |
| `backend/app/tests`, `frontend/tests`, `docs/qa` | Automated verification and recorded evidence |

Generate the submission archive with `make-submission-zip.bat` (Windows) or `bash make-submission-zip.sh`. The script excludes local `.env` files, databases, dependency folders, builds and caches, then checks archive paths and known exposed credential fingerprints. Keep local secrets in `backend/.env`; use empty secret fields in `.env.example`. The checks cannot detect every possible credential: review newly added configuration before submission.

Judge Mode controls default to enabled for SIH. Set `VITE_ENABLE_JUDGE_MODE=false` before building to hide them. Demo weather stays explicitly labelled.
