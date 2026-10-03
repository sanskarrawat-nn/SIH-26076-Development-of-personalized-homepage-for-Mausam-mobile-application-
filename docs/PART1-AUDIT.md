# Part 1 audit and gap analysis

Base: Combined 2.0. Preserved React/Vite frontend, FastAPI/Pydantic backend,
SQLAlchemy snapshots, Open-Meteo adapters, planner endpoints, local preferences,
Judge Mode, service worker, and Vercel/Render deployment layout.

| Feature | Original state | Changes / modules | External dependency | Regression risk / checks |
|---|---|---|---|---|
| Branding | Mausam Personal | App, onboarding, HTML, manifest, API, docs: Mausam Setu | None | Startup/PWA title; preserve storage keys and package identifier |
| Dynamic homepage | Fixed structural order, ranked cards | personalization/layout.py; DynamicHomepage | None | DOM ordering per persona, multi-interest; preserve all sections |
| Safety override | Advisory list, no priority layer | safety/engine.py; Safety.jsx | Official feed unavailable | Zero preference weights cannot suppress critical screening |
| Emergency view | Missing | Safety panel, simplified dashboard, expand control | External map, user-triggered share | Storm demo, expiry, missing data, return to full view |
| Risk 0–100 | Relevance only | Central policies.json risk configuration | Existing forecast/AQI | Missing, partial, expired inputs; contributions and boundary checks |
| Risk vs relevance | Priority score present | Distinct API fields and explanation panels | None | Scores independently computed |
| Provenance | Source/status/retrieval present | Per-metric expiry/quality; rule input metadata | Existing providers | Cached/demo labels, bounded expiry, source dialog |
| India-first providers | No active official feed | Five adapter contracts, validation, status endpoint, optional service extension | Authorized payload access and mapping | No network call or live claim when unconfigured; reject wrong authority/location |
| AQI scale | US AQI explained in some places | Explicit US AQI labels; optional separate Indian NAQI contract | CPCB access not configured | No conversion or relabeling |
| Why this for me | Reasons and optional score chart | Activity, place, preference effects, risk, relevance, inputs, policy version | None | Explainable trace, source and freshness |
| Explainable rules | Existing deterministic rules | Metadata added; original rules retained | None | Existing persona tests plus new risk tests |
| English/Hindi | English only | JSON catalogs, locale switch, offline Devanagari font | None for text; device voice for TTS | Hindi rendering and grounded answer; unknown provider text stays verbatim |
| Ask Mausam | Missing | assistant.js, AskMausam.jsx | Browser STT/TTS capabilities | Typed fallback, missing data, different city, bounded navigation |
| Accessibility | Focus/modal foundations | Independent six controls, read aloud, keyboard, text labels | Browser audio; assistive technology | Text sizing, toggles, Escape; no formal accessibility certification |
| Planning clipping | Panel padding absent; native summary marker | Shared spacing, padded panels, explicit summary icon row, min-width | None | Expanded forms and nested cards at ten widths |
| Sidebar/content width | Existing calc width | Parent-relative sizing retained; new grids minmax(0,1fr) | None | Ten widths, 200% text |
| Map activation | Additional Load button | Mount iframe on explorer opening | Windy | No request at homepage load; auto-load on open |
| Map loading/failure | Manual reload | Loading overlay, timeout and Retry only after failure | Browser cross-origin limitations | Hung transport, offline/reconnect; iframe onload is not proof of layer pixels |
| Map layers | Seven layers | Retained, URL updates with layer and units | Windy | All seven overlays |
| Map location | Picker closed map | Inline picker, same location state | Existing geocoding | Recenter without reopening/GPS re-request |
| Judge/map separation | Existing notice | Retained and strengthened provider notice | Windy independent timeline | Demo labels and provider privacy notice |
| Map layout | Two columns, nested sidebar scroll | Responsive height; one-column mobile; removed summary nested scrolling | None | Ten modal widths |
| Providers only | Strict mode only; normal mode demo fallback | Both provider modes forbid automatic demo fallback | Provider/cache availability | Outage and cache tests; explicit demo still works |
| Existing planners | Implemented | Retained; localized controls | Traffic/tides keys; airport provider | Seven original planning checks |
| Offline/PWA | Exact-query cache + shell | Expiring risk/safety, font precache; new prefs retained | First successful online load | Production reload, wrong query isolation, recovery |
| Deployment | Existing Vercel/Render files | Microphone policy self-only; fonts path; demo fallback disabled | User hosting account | Production build; deployment not performed |

Existing database tables and local storage keys remain unchanged. No new database
migration is necessary. No account, community, route-weather, or adaptive-learning
feature from Part 2 was added. Community provenance enums are reserved schema
values only; they do not imply that community reports exist.
