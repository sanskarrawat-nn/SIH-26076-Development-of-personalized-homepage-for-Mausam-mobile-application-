# Part 1 verification

Verified locally on 26 September 2026. Browser tests use headless Chromium;
backend tests use Python 3.12. The local build used Node 24; the supported setup
and CI target remain Node 22. Node 22 was not separately executed here.

| Check | Result |
|---|---|
| Backend pytest | 109 passed |
| Frontend unit tests | 12 passed |
| Original homepage browser suite | 9 checks passed |
| Original planning suite | 7 checks passed |
| Combined-app browser suite, with automatic-map expectation updated | 6 checks passed |
| New Part 1 browser suite | 8 checks passed |
| Production offline checks | 5 checks passed |
| Production Vite build and generated service worker | Passed |
| Backend Ruff checks / formatting | Passed |
| Frontend Prettier gate | Passed |

Responsive dimensions tested: **360, 390, 412, 768, 1024, 1280, 1366, 1440,
1536, 1920 pixels**. Expanded planning forms, nested cards, summary controls,
page overflow and map modal bounds were checked. Mobile text was also checked
at 200%. Screenshots in `docs/qa/part1-*.png` show the final interface, including
real Devanagari font rendering.

The map tests replace the external iframe transport with a deterministic page.
They verify opening behavior, all seven layer parameters, in-place coordinate
changes, loading timeout, retry, offline recovery and responsive layout. They do
not verify Windy's live layer content. Speech fallback and typed weather/intent
behavior are tested; microphone transcription and audible TTS on a real device
are not claimed as tested. Legacy QA files describe prior live-provider checks;
this run does not re-certify upstream services, paid integrations or credentials.

Backend tests include bounded risk contributions, missing and expired data,
critical thresholds, safety priority despite zero preference weight,
wrong-location/expired official warnings, adapter provenance, persona layouts,
existing planners and provider/cache behavior. Client tests include English and
Hindi answers, no-data handling, separate-city guard, bounded navigation and
expired offline emergency suppression.

The production offline check opens the real built shell after going offline,
verifies Demo/Cached labeling, refuses a different preference query, recovers
online, and loads the bundled Hindi font for the first time while offline. The
service-worker fix ignores `Vary` only for the explicit public same-origin
precache list; API responses remain outside service-worker caching.

One upstream Starlette/AnyIO deprecation warning remains in pytest; there are no
test failures. Public deployment and physical-device/screen-reader evaluation
remain external verification steps.
