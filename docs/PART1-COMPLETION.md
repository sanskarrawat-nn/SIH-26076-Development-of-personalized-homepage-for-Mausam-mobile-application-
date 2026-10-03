# Mausam Setu — Part 1 completion

Version 2.1 · Problem statement SIH26076 · Smart Automation

**One Forecast. Different Users. Better Decisions.**

## Start and demonstrate

Extract into a fresh folder. Stop the previous app's terminals, then run
`start-windows.bat` (Python 3.12 and Node.js 22 installed). Open
http://localhost:5173. Existing device preferences use compatible storage keys.

1. Enable Judge Mode and select **Pleasant day**. Switch Fitness + Health,
   Travel, and Agriculture. Whole sections now move in document order. Use
   **Why this position?** to inspect layout reasoning.
2. Select **Thunderstorm**. Emergency Mode appears first, with clearly marked
   demo conditions. **Show full dashboard** restores access to all sections.
3. Inspect **Weather risk → How risk is calculated**. This is a custom prototype
   screening index, separate from personalized relevance and event comfort.
4. Open **Why this for me?** to inspect both scores, source, data age, rule ID,
   activity, preference weights and raw inputs. Preferences includes interest
   priority sliders; these never affect safety precedence.
5. Choose **हिन्दी** in the language control. Core controls, persona labels,
   recommendation text and the assistant use JSON catalogs. A bundled SIL-OFL
   font makes Devanagari available offline. Third-party source text and unknown
   diagnostic/provider messages may remain in their original language.
6. **Ask Mausam** accepts typed or spoken questions such as “Kal baarish hogi?”,
   “tomorrow rain”, “temperature”, “morning running”, and “visibility”. It uses
   the selected place and loaded forecast. Use planners for exact flight,
   school, route and schedule questions. Enable **Voice navigation** to use
   “open map” and “open settings”. Recognition/transcription is browser-provided;
   this is not a general conversational AI or a trained ML weather model.
7. In **Accessibility**, independently select large text, contrast, reduced
   motion, prominent warnings, simplified screen-reader view, or voice
   navigation. **Read weather aloud** uses browser TTS; stop is available.
8. Open **Weather map**. Loading starts automatically. Change layers or use
   **Choose another place** inside the explorer. The homepage does not contact
   Windy before opening the explorer. Retry appears only after timeout/error.
9. Open **Your plans → Customize my plans**. Existing workouts, sensitivities,
   school times, events, crop calendars, journeys, airports and tides remain.

## Implemented

- User-facing Mausam Setu branding, tagline, browser/PWA metadata and docs.
- Backend homepage layout contract and actual section reordering by interests,
  weights, activity, exposure sensitivities, plan configuration, recommendation
  relevance and risk.
- Deterministic safety precedence and simplified emergency presentation.
- Independent weather-risk calculation with per-component inputs, times,
  thresholds, points, missing-data coverage and expiration.
- Provenance extensions, rule metadata, explicit US AQI labeling and detailed
  explanations. No false ML training or official endorsement claims.
- No automatic demo fallback in either provider mode; explicit demos preserved.
- Hindi/English catalog architecture, bundled font, bounded weather assistant,
  STT/TTS controls, typed fallback and independent accessibility settings.
- Planning alignment, parent-relative width, shared spacing, automatic map load,
  seven layers, location recentering and retry/offline behavior.
- Offline risk/safety expiry and preservation of all existing features.

## Partially implemented / bounded scope

- **Official provider integration:** IMD, CPCB, INCOIS, ICAR and NDMA have
  normalized adapter contracts, identity/location/expiry checks and a service
  extension point. They are unconfigured and do not fetch live official feeds.
  A provider-specific authorized loader must map the real schema and geographic
  coverage. Typed contracts alone are not a live integration.
- **Provider independence:** the existing secondary weather attempt uses a
  different Open-Meteo model, not an independent provider organization. A truly
  independent secondary source remains unconfigured.
- **Language coverage:** core UI and common generated recommendations translate;
  original METAR/TAF, source names, URLs, raw rule JSON and some exceptional
  provider/planner diagnostics remain verbatim. The translation fallback is
  explicit English rather than fabricated source translations.
- **Voice:** bounded intents for the current selected location, today/tomorrow,
  morning, weather and navigation. No free-form city geocoding or arbitrary
  date interpretation. Real microphone/TTS behavior depends on browser,
  permission, installed voices, HTTPS and the speech provider's connectivity.
- **Emergency:** app screening is not an official red alert or certified warning
  system. The weather map is not a safe-route/evacuation map. Flood-specific
  detection needs authoritative hydrological data; heavy rain alone is not a
  flood diagnosis. No notification is sent in the background.
- **Map:** load, offline, timeout and retry are tested. Cross-origin iframe load
  events cannot prove that Windy actually rendered a requested layer. Provider
  error pages may still fire onload. Open separately is retained as a fallback.
- **Accessibility:** keyboard and layout checks passed; real screen-reader and
  color-vision user testing remains advisable before claiming conformance.

## External dependencies / API keys

| Capability | State / requirement |
|---|---|
| Existing weather, air, soil, marine | Open-Meteo adapters retained; subject to network, coverage and terms |
| Official warnings / Indian AQI / official ocean and crop feeds | Authorized access plus provider-specific mapping required; no live claim |
| Traffic | `TOMTOM_API_KEY` on backend |
| Tides | `WORLDTIDES_API_KEY` on backend |
| India pollen | No verified local source configured |
| Voice | Browser capabilities/permission; no app API key |
| Windy | Independent external embed, network access required |
| Deployment | Existing Vercel/Render instructions retained; no public deployment performed |

## Scoring and source cautions

`backend/app/core/policies.json` centralizes the custom risk thresholds. The
index sums capped contributions from precipitation, wind, temperature,
humidity, visibility, **US AQI**, UV, thunderstorms and available official
warnings, then caps the result at 100. It screens the next six hours using the
worst available value for each component. Components may peak at different
times, so this is a planning screen, not a calibrated probability. Partial data
can underestimate risk. A single critical trigger activates Emergency Mode
regardless of the aggregate score or user preferences.

Lightning action wording is grounded in [NWS lightning safety](https://www.weather.gov/safety/lightning-tips).
General official-warning links point to the relevant Indian agency, without
claiming an integrated feed. The emergency number follows the [Government of India helpline directory](https://www.india.gov.in/directory/helpline) and is offered as a user-triggered
call action, not an automated call. No alerts/messages were sent to anyone.

## Test and build results

See `PART1-TEST-RESULTS.md` for the final run, and `qa/part1-checks.json` for
responsive widths and browser checks. Original tests were preserved except for
assertions specifically changed by the requirements: provider outage no longer
means demo, and map opening no longer requires an extra button.

See `PART1-FILES-CHANGED.txt` for the full changed-file list and
`PART1-AUDIT.md` for the feature/module matrix. Existing functionality was
regression-tested; live services requiring credentials are not represented as
verified end-to-end integrations.

Ready for PART 2 — Community Intelligence, Advanced Personas, Route Weather and Adaptive Personalization.
