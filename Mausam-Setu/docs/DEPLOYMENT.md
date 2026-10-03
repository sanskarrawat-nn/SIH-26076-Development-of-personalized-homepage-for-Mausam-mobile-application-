# Deployment: Vercel frontend + Render backend

No hosting account has been provisioned and no public URL is claimed. The archive contains deployable configuration; deployment requires your connected accounts/repository.

## 1. Push the extracted project to GitHub

Use the project root containing `frontend`, `backend` and `render.yaml`. Never include `.env`, `node_modules` or local databases. The included CI runs backend tests, frontend tests and the production build.

## 2. Render

Create a Blueprint from this repository using `render.yaml`, or create the web service manually:

- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --no-access-log`
- Health check: `/ready`
- Database: Render PostgreSQL; set `DATABASE_URL` to its internal connection string.
- `CORS_ORIGINS`: exact frontend origin, e.g. your actual Vercel URL; no trailing slash. Comma-separate only origins you control.
- `DEMO_FALLBACK` is a legacy ignored setting. All provider modes show unavailable after valid cache expires. Demo Mode and Judge Mode remain explicit.

The database URL adapter supports Render's postgres/postgresql scheme through psycopg. SQLite is for local development and is not durable on an ephemeral hosted disk. Provisioning services/databases may incur hosting charges; choose account settings yourself.

## 3. Vercel

Import the repository. Root directory `frontend`; framework Vite; install `npm ci`; build `npm run build`; output `dist`. Set `VITE_API_BASE_URL` to the actual Render HTTPS origin. This is a public build-time origin, not an API secret. Deploy. Update Render CORS to the exact resulting Vercel origin.

## 4. Verify the deployed system

- `/health` and `/ready` return 200.
- Live-provider mode produces Estimated weather, or valid cached/unavailable status. Check provenance and timestamps.
- Judge Mode heat/travel/agriculture/missing scenarios work without provider calls.
- Browser has no CORS failures; source details identify model outputs correctly.
- Test saved places, city search, geolocation on HTTPS, mobile layout and unit conversion.
- Load the production site once online, allow its service worker to activate, then test offline reload and the last-query cache.
- Set provider usage/licensing, logging and retention policy before public use.

PWA installation depends on browser/platform support. Safari users can Add to Home Screen. No native APK or App Store package is included.

## Optional services

Configure `TOMTOM_API_KEY` and `WORLDTIDES_API_KEY` as backend secrets only. Leave blank to show unavailable live traffic/tides. See `UPGRADE-1.1.md` for provider setup, explicit-query behavior and limits. Frontend-to-backend CORS now supports POST for journey/tide planners. Configure `PROVIDER_TIMEOUT` (default 15 seconds) for your hosting network.


## Part 3 release checks

Use the same external repository/service identities when updating an existing deployment. Internal `mausam-personal-*` Render resource names remain for compatibility; the displayed application name is Mausam Setu.

Frontend configuration is build-time: changing `VITE_API_BASE_URL` requires rebuilding and redeploying. It must be your actual HTTPS backend origin in production. Empty is valid only when a same-origin API reverse proxy is configured. No production URL is invented. Verify exact CORS origin on the backend, including custom domains.

Startup creates absent tables. See DATABASE.md for backup and Part 1/2 upgrade procedure; do not treat `create_all` as a general schema migration tool. Configure `COMMUNITY_REVIEW_TOKEN` only if a responsible human reviewer is assigned. Keep paid provider keys on the backend. Blank keys leave optional services unavailable.

Use `/health` for liveness and `/ready` for database readiness. Confirm the versioned native endpoint with explicit demo mode, then separately test authorized live providers. Test a recoverable provider outage and database outage before public operation.

`npm run build` generates a content-hashed service-worker precache including lazy dialog chunks and local font. On activation it removes old shell caches. Reload after deployment to use the new client; an already open page may still run old JavaScript until reloaded. Warm the production site before offline tests. HTTP APIs are not blindly cached by the service worker: the application owns exact-query data expiry.

No hosting deployment, paid provider call, real closed-app push or hosted PostgreSQL restore was performed during this release. The supplied GitHub Actions workflow describes CI; a hosted run is separate from local test evidence.
