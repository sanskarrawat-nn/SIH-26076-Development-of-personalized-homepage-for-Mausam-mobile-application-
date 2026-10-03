# Part 2 verification

## Baseline before changes

- Backend: 109 passed.
- Frontend unit tests: 12 passed.

## Integrated build

| Check | Result |
|---|---|
| Backend pytest | 141 passed; one existing Starlette/AnyIO deprecation warning |
| Frontend unit tests | 16 passed |
| Original dashboard browser suite | 9 workflow checks passed |
| Planning browser suite | 7 workflow checks passed |
| Combined-feature/map browser suite | 6 workflow checks passed |
| Part 1 regression browser suite | 8 workflow checks passed |
| Part 2 browser suite | 8 workflow checks passed |
| Production offline suite | 5 checks passed |
| Ruff check and formatting | Passed |
| Prettier formatting | Passed |
| Vite production build and generated service worker | Passed |

Browser workflow counts describe grouped assertions, not independent hardware/device certifications. Automated suites reported no JavaScript page errors. Screenshots are in `docs/qa/`.

## Important coverage

Backend tests cover report creation, spoofed verification fields, rounded coordinates, no public private text, hashed deletion receipts, reviewer authorization, expiry, EXIF removal and invalid images, duplicate reports not increasing confidence, complete Student windows, Highland cautions, marine provenance, bounded route sampling, ETA/weather matching, missing traffic, saved-plan duration/gaps, notification policy, deterministic new demos and unchanged safety under learned weights.

Hourly AQI testing uses a mocked provider response to verify that the existing air request is reused and matching forecast hours are joined correctly. A missing AQI hour cannot become a complete future-air assessment.

Frontend unit tests exercise learning bounds, time buckets, disable/reset behavior, notification consent/severity/category/cooldown/expiry, serialized batch deduplication, official-first notification ordering and new schedule normalization.

Part 2 browser tests cover Student/Highland integration, Useful/reset persistence, Low Data map suppression versus normal automatic loading, community marker details and review labels, automatically evaluated saved plans, emergency layout, and the report form/cache/expiry flow. New layouts were checked at 360, 390, 768, 1440 and 1920 pixels. Part 1's expanded planning/map tests also cover ten widths and 200% base text.

Production offline checks cover shell reload, explicit Demo/Cached labels, exact-query cache isolation, reconnection and first offline Hindi-font loading. Community offline tests use a deliberately failed mocked transport and a saved public report, then force its expiry and confirm it leaves the active list.

## Scope and limitations

- Browser tools simulate viewports; physical iOS/Android devices were not used.
- Windy transport is mocked for deterministic UI tests; actual imagery and cross-origin pixels are not verified.
- Community form browser tests use a labeled transport fixture. Real report validation/persistence is separately exercised with SQLite and the FastAPI TestClient.
- No live paid TomTom/WorldTides account or official authority feed is configured. Adapter tests and explicit unavailable behavior pass; live account access is unverified.
- No external notifications/messages were sent. Notification display is mocked for policy tests; deployed Web Push is not provided.
- No meteorological forecast-accuracy, clinical or agronomic validation is claimed.
- Test runtime: Python 3.12, Node 24, headless Chromium. Supported Node 22 installation remains documented but was not separately executed here.
- An initially damaged browser binary was restored from the existing compressed runtime. Earlier launch failures and an unavailable browser-download attempt were environment failures; the final browser suites completed successfully.

Actual terminal outputs are preserved as `docs/qa/part2-*.txt`, with browser assertion summaries in the corresponding JSON files.
