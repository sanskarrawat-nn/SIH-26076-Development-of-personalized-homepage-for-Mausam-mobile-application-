# Mausam Setu 1.1 — new features and setup

Problem: SIH26076. Organization: Ministry of Earth Sciences. Department: India Meteorological Department, as shown in the supplied problem-statement screenshot. The archived original build directive incorrectly names MIC.

## Start or update on Windows

1. Close the old app's backend and frontend terminal windows.
2. Extract this ZIP into a new folder. Do not run it inside the ZIP viewer.
3. With Python 3.12 and Node.js 22 installed, double-click `start-windows.bat`.
4. Keep both server windows open and visit http://localhost:5173.
5. If an old service worker still shows the previous version, close other app tabs and refresh once. If necessary use the browser's site-data controls to clear localhost data (this removes saved preferences).

No account or API key is needed for the default weather, soil, air, marine and demo flows. Airport bulletins are requested only when you submit an ICAO code. Internet access is required for online providers.

## Your plans

Select your interests, then open **Your plans → Customize my plans**. Relevant controls appear for selected interests. Click **Apply my plans** to save and recalculate.

- **Health:** optional air, pollen, sun and heat sensitivity preferences. These use documented, more cautious screening thresholds, not medical diagnoses. European grass, birch and alder pollen counts are connected. Pollen for India is unavailable from this source.
- **Fitness:** running, walking or cycling, light/moderate/vigorous intensity, 30–240 minute sessions, and preferred start/finish hours. A complete forecast and daylight window are required. Current AQI is considered when available; future AQI is not modelled by this rule.
- **Family:** custom school drop-off and pickup times, with the next matching one-hour forecast periods. Use Journey & airport weather → School journey to specify separate home and school coordinates.
- **Events:** date, start time, duration and indoor backup. Every overlapping forecast hour is required. Comfort uses the worst hourly temperature/humidity/wind score. Rain, UV, visibility and thunderstorm concerns remain separate from comfort. It is a heuristic, not a probability of safety. Dates outside the forecast horizon show unavailable.
- **Agriculture:** model soil moisture at 0–1 cm and 3–9 cm, complete forecast-rainfall accumulation, advance freezing advisories, and three sourced calendar combinations: South India tomato; Tamil Nadu okra; North Western Plains wheat HD 3226. Choose the matching region explicitly. These are not nationwide crop recommendations or irrigation prescriptions.
- **Commute/travel/family journeys:** choose two places (search, saved places or exact coordinates), departure and arrival times in each place's local timezone, and check their forecasts. This does not sample the entire route.
- **Flights:** choose Flight / airports, select nearby locations, and optionally enter four-letter ICAO codes, e.g. VILK and VIDP. Recent METAR observations and a TAF covering the selected time are shown when available and geographically consistent. No flight delay/cancellation status is inferred.
- **Marine:** wave height, period and water temperature. Open High & low tides to request a timetable. Online tides need a WorldTides key; the coastal demo works without one.

## Optional live traffic and tide services

Copy `backend/.env.example` to `backend/.env`, then configure keys from your own provider accounts:

```dotenv
TOMTOM_API_KEY=your_key_here
WORLDTIDES_API_KEY=your_key_here
```

Restart the backend. Never put these keys in frontend files or commit `.env`.

TomTom routing supplies traffic-aware driving duration, distance and traffic delay. The app displays endpoint weather alongside those totals. It does not yet integrate route-wide weather, a road-closure list or alternative routes.

WorldTides supplies high/low events and reference datum. The app checks for nearby marine coverage and a nearby returned tide point. Required attribution is displayed. Tide queries are explicit button actions, not automatic polling; a lookup can consume provider credits. No shared cross-user tide-response cache is used. Check provider terms and account quotas before enabling public usage.

## Judge Mode

All demo weather is anchored to 15 June 2026. Set event and journey dates between 15 and 21 June 2026 to demonstrate schedule planning. A blank event date uses the reference day.

New scenarios: Overnight frost, Thunderstorm, Coastal day and Pollen demonstration. Coastal day includes simulated wave metrics. Tide and traffic demo outputs are explicitly simulated, independent of real route or coast conditions. Official warnings and airport bulletins are never fabricated.

## Still unavailable

- Official IMD warning ingestion: the documented district-warning endpoint returned HTTP 401 in this environment. Official IMD and INCOIS links are provided.
- India pollen from the selected provider; additional crop/region calendars.
- Flight delay/cancellation status, route-wide weather, explicit road closures.
- Integration into the official Mausam mobile app, cloud accounts, background push notifications.

## Evidence

See `TESTING.md`, `qa/online-providers.json`, `qa/aviation-provider.json` and the browser check reports. Traffic and tides need credentials for end-to-end live verification; adapters have controlled response tests. Online service results are point-in-time checks, not reliability guarantees.

## Sources

- Weather and soil variables: https://open-meteo.com/en/docs
- Air/pollen coverage: https://open-meteo.com/en/docs/air-quality-api
- Marine: https://open-meteo.com/en/docs/marine-weather-api
- Airport reports and schemas: https://aviationweather.gov/data/api/
- Tide contracts: https://www.worldtides.info/apidocs
- Traffic route contract: https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route
- South India tomato calendar: https://agritech.tnau.ac.in/org_farm/orgfarm_tomato_climate.html
- Tamil Nadu okra calendar: https://agritech.tnau.ac.in/horticulture/horti_vegetables_bhendi_Soil.html
- Wheat HD 3226 region and sowing dates: https://www.icar.gov.in/node/12081
