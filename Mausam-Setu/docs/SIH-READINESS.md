# SIH demonstration and team questions

**Mausam Setu — One Forecast. Different Users. Better Decisions.**

Opening sentence: “A forecast tells everyone the weather. Mausam Setu turns the same forecast into different, explained decisions for a runner, farmer, student or family, while keeping safety warnings ahead of preferences.”

## Reproducible demonstration

| Step | Action | Point to explain |
| --- | --- | --- |
| 1 | Start the app; enable Judge Mode; choose Extreme heat | Explicit scenario dated 15 June 2026, not current observations |
| 2 | Choose Fitness + Health | Workout window screening, feels-like heat, UV and US AQI; “no matching window” is a valid honest result |
| 3 | Open Why this for me? | Context, measured factors, action, independent risk/relevance, source/expiry and expandable real score components |
| 4 | Choose Agriculture without changing scenario/location | Same weather; crop, soil, rain/irrigation and spraying context change the decision and layout |
| 5 | Choose Student, then Family | College departure/return/practice, then school/play guidance; edit schedule to demonstrate contextual windows |
| 6 | Select Emergency Mode; optionally Official Warning (SIMULATED) | Safety takes first position despite preferences; official fixture is visibly simulated and not an actual IMD bulletin |
| 7 | Select Community Flood Report; open Report map and a marker | Coarse location, timestamp, confidence basis and unverified state; switch Verified Community Report to show project-review fixture |
| 8 | Select Hindi Voice Example | Sets Fitness + Health, pleasant fixture and Hindi; keeps a valid tomorrow-morning window available |
| 9 | Ask “Kal morning running ke liye best time kya hai?” | Hindi answer uses the requested tomorrow-morning forecast and configured workout duration; no LLM-generated weather. Type if browser speech is unsupported |
| 10 | Open Weather Map | Automatically loads independent Windy layers after this deliberate action; no normal Load interactive map button; selected coordinates/layers remain coherent |
| 11 | Demonstrate production offline/reconnect | Warm the production build and a response, disconnect and reload. Show cached/unavailable timestamps and local controls, then reconnect |

For step 11, build with `npm run build`, then `npm run preview`. Configure its backend API origin before building; a static preview does not inherit the Vite development API proxy. Let the service worker activate once online. Demo snapshots must remain **Demo**, even offline; to demonstrate **Cached**, first warm a real provider response or use the explicitly labelled offline test fixture. Never rename a demo response LIVE/Cached to make a presentation look successful. An unwarmed installation cannot load fully offline.

On phones, secondary sections have labelled disclosure controls. Open the relevant section before showing its settings. Low Data Mode deliberately suppresses external maps, so turn it off before step 10. It does not disable safety guidance.

## Technical answers

**Is this trained AI?** No. It is an explainable rule engine plus bounded adaptive preference learning. Model forecasts come from upstream weather providers; we did not train a weather model or an LLM.

**What is personalized?** Persona, activity, schedule, sensitivities, location, time, current/forecast measurements, freshness, manual interest weights and device feedback shape relevance and section order. One bundle is reused across personas.

**What is the difference between risk and relevance?** Risk is a capped prototype hazard-screening index over available next-six-hour measurements. Relevance ranks what matters to this user. Neither is a probability of safety or measured prediction accuracy. A critical hazard can override a low aggregate risk score.

**Can learning hide danger?** No. Safety evaluation is separate; critical thresholds and applicable severe official warnings determine mandatory emergency sections. Manual/learned weights do not alter those thresholds.

**How do you verify community reports?** We validate coarse coordinates/time/category, sanitize photos, keep private evidence, screen fresh weather context and show a confidence checklist. Anonymous duplicates are not independent votes. Only a configured project reviewer can apply local verification; it is never labelled government verification.

**How accurate is the app?** No calibrated end-to-end accuracy percentage is available. Tests verify software behavior, provenance and boundary handling, not weather forecasting skill. Real-world evaluation needs observations, region/season coverage, error metrics and user outcome studies.

**How does it fit the official Mausam mobile app?** A versioned JSON endpoint returns normalized weather, risk, warnings, ordered widget definitions, actions, plans and community context without React dependencies. A future native client maps widget types to native components. Official authorization and integration remain future work.

**Where is data stored?** SQLAlchemy snapshots and community evidence use SQLite locally or PostgreSQL configuration in deployment. Preferences, learning, saved plans/places and contacts stay on the device. No account sync exists.

**How do maps work?** Windy renders its own external weather layers centered on selected coordinates. Opening the explorer loads it automatically. Citizen reports use an approximate separate local SVG diagram; it is not a GIS basemap or a Windy overlay.

**What if a provider fails?** Primary model → secondary model on the same provider → valid cache → unavailable. Optional integrations fail independently. Explicit demo is never an outage fallback. Cached data retains source, retrieval time and expiry.

**Does it work offline?** A warmed PWA shell, preferences, emergency reference and exact-query cached response can work. Expired risk/recommendations are discarded or unavailable. Maps, fresh provider data and new server submissions need a connection.

**Does it send notifications when closed?** Not in this release. Foreground PWA delivery is consent/category/severity/expiry/cooldown gated. Background sender, subscriptions and scheduled jobs are unconfigured.

**Does it predict landslides, flights or medical conditions?** No. Highland weather screening is not landslide prediction. METAR/TAF is airport weather, not flight delay. Environmental exposure guidance is not diagnosis.

**What is production work?** Authorized official loaders; native app integration; shared abuse limits and reviewer identities; hosted PostgreSQL migration/recovery; real-device accessibility/speech/push testing; licensed provider contracts; region-specific validation; human Hindi review. See PART3-COMPLETION.md for the exact release boundary.
