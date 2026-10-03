# Final verification · Part 3

All commands below completed successfully on the final code. Evidence is saved under `docs/qa/part3-*.txt`; browser check JSON and screenshots accompany it. Runtime: Linux, Python 3.12, Node 24, headless Chromium. Provider transport and demonstration fixtures are identified in tests; results do not establish real paid-provider availability.

| Check | Outcome |
| --- | --- |
| Backend `python -m pytest -q app/tests` | **150 passed**; one Starlette/AnyIO deprecation warning |
| Backend Ruff lint | Passed |
| Backend Ruff format check | Passed |
| Frontend `npm test` | **18 passed**, no failures |
| Frontend Prettier check | Passed |
| Production Vite/PWA build | Passed |
| Original browser suite | 9 grouped checks; no recorded page errors |
| Planning browser suite | 7 grouped checks; no recorded page errors |
| Merge browser suite | 6 grouped checks; no recorded page errors |
| Part 1 browser suite | 8 grouped checks; no recorded page errors |
| Part 2 browser suite | 8 grouped checks; no recorded page errors |
| Part 3 browser suite | 4 grouped checks spanning multiple widths/states; no recorded page errors |
| Production offline suite | 5 grouped checks: shell, labels, exact-query isolation, reconnect, Hindi font |
| Matched original/final UI capture | Completed; no recorded page errors; 14 screenshots across desktop/mobile and key states |

**Totals:** 150 backend tests, 18 frontend tests and **47 grouped browser/offline checks**. A grouped check includes multiple assertions; it is not a claimed count of independent test cases or devices.

## Coverage

Backend verification includes normalized provenance, source expiry, official-warning validity, risk critical overrides, unchanged risk under preference changes, multi-persona composition, fallback/cache behavior, schedule duration/daylight coverage, partial/missing metrics, US AQI, soil/marine/pollen boundaries, route geometry/ETA samples, airport/tide/traffic failure handling, community privacy/image validation/review/expiry/deletion, notification eligibility and new native-envelope behavior. Part 3 specifically adds duplicate rejection, chunked-body limits, request throttling, non-leaking DB failures and tomorrow-morning planner coverage.

Browser suites cover onboarding, persona changes and actual DOM order, units, saved places, plans/customization, destination/flight/tide forms, weather layers/recenter/automatic open, independent external-map provenance, timeout/retry/offline, source explanations, report submission/cache/expiry fixtures, learning/reset, low-data suppression, emergency override, Hindi queries, accessibility switches, dialog keyboard behavior and provider-only mode.

Widths tested: **360, 390, 412, 768, 1024, 1280, 1366, 1440, 1536, 1920**. Part 1 checks expanded plan controls and map bounds at all ten widths; Part 3 expands home disclosures and checks Preferences, Accessibility, Ask, explanation and emergency across all ten. Regression suites also check 200% text and 390px journey/tide forms. Layout assertions inspect page/modal overflow and visible form bounds. They do not prove every possible translated string fits every OS font.

The exact question **“Kal morning running ke liye best time kya hai?”** is checked in Hindi against the requested next-day morning window; no data is invented if the planner cannot find a complete valid session. Speech hardware and remote recognition are not exercised by typed-question tests.

## Build size and performance scope

Final main JS: **414.45 kB / 122.94 kB gzip**. Separate Ask dialog: 2.22 kB / 1.12 kB gzip. Weather Map dialog: 5.24 kB / 2.24 kB gzip. CSS: **48.46 kB / 11.21 kB gzip**. These are Vite build-reported decimal kB. Existing local Devanagari font is preserved and precached. No new heavy visual dependency, remote font, background image/video or animation engine was introduced. Bundle size is not a field performance/Lighthouse score.

## Corrections made during verification

A lazy-map regression check initially inspected the dialog before the chunk had loaded; it now waits for the actual low-data notice. Mobile disclosure implementation was adjusted to preserve section/component identity across resizing. A test selector was made specific to the direct Device preferences summary instead of matching an ancestor disclosure. The visual-comparison harness uses separate baseline Vite caches when dependencies are shared. These corrections were followed by successful relevant and final regression runs; failed intermediate screenshots are excluded from delivery.

## Verification limits

- No real Windows startup, Android/iOS hardware, Safari/Firefox, assistive-screen-reader study, microphone permission workflow or actual OS notification delivery was performed here.
- No official IMD/CPCB/INCOIS authorization, paid TomTom/WorldTides call, background push sender, hosted PostgreSQL upgrade or public deployment was tested.
- Offline testing uses a warmed production build and explicit demo data. It verifies honest Demo/Cached handling and preference-key isolation, not a claim of current LIVE weather while disconnected.
- The map transport is mocked for deterministic browser checks; tests verify URLs/coordinates/layers and host UI, not live cross-origin Windy rendering internals.
- No penetration test, load test, dependency advisory audit, calibrated weather accuracy evaluation, usability study or accessibility certification is claimed.
- The Starlette/AnyIO deprecation warning is retained in logs; it did not fail tests.
