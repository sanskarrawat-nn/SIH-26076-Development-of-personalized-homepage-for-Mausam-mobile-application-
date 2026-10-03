# Combined app — version 2.0

This project combines the working features in Mausam Setu 1.2 with the additions in `mausam-personal_ajay(1).zip` (same source content as the previous upload). One React app and one FastAPI backend serve the combined experience. Duplicated homepages, conflicting weather schemas and placeholder services were consolidated.

## Feature mapping

| Feature | Earlier app | Uploaded app | Combined implementation |
|---|---|---|---|
| Eight interests and weather-based personal advice | Working, with explanations and ranking | Working rule classes | Existing configurable rules retained; high-humidity health caution added |
| Current, hourly and seven-day forecasts | Working | Working | Unified timezone-aware, source-labelled forecast |
| Heat, rain, air-quality and other demo scenarios | Twelve controlled scenarios | Demo scenarios and persona switching | All twelve existing scenarios and persona switches retained |
| Weather map | Absent | Embedded homepage and full map | Homepage entry plus expanded map explorer |
| Temperature, rainfall, wind, humidity layers | Absent | Windy controls | Seven selectable layers with per-layer provider configuration |
| Radar, satellite, pollution map | Absent | Radar; clouds called satellite; PM2.5 called AQI | Radar, actual satellite selection and PM2.5 concentration correctly identified |
| Map location details, alerts and personal impact | Absent | Sidebar | Shared app result displayed next to the independent Windy map |
| Live clock | Static forecast date | Browser-local ticking clock | Ticking clock for the selected weather location; demo date remains separate |
| Worldwide city search | Open-Meteo | India search | Retained worldwide search plus a detailed India search mode |
| Village, district and PIN-code search | Absent | Nominatim | Photon / OpenStreetMap search with backend caching; result coverage varies |
| GPS and reverse geocoding | Rounded GPS | Startup GPS and reverse name | User-triggered rounded GPS with reverse place naming; no automatic history entry |
| Saved places and recent searches | Working | Settings placeholder | Existing working saved/recent places retained |
| Alert dropdown | Full advisory dialog | Dropdown; read button had no handler | Accessible inbox, unread count, persistent mark-as-read, full detail dialog |
| Pressure, dew point and visibility | Visibility available | Hard-coded values in card | Provider pressure/dew point, existing visibility; missing values stay unavailable |
| Wind direction | Absent | Provider collected it | Available as a source-tracked metric |
| Sunrise and sunset | Daily forecast | Hard-coded card times | Provider times now also shown in current overview |
| AQI and UV category labels | Numeric metrics | Simplified categories | US AQI and UV categories with unavailable-state handling |
| AQI, particles, pollen, soil and marine | Working with availability checks | Some placeholder/default values | Actual available estimates retained; particle metrics visible in environment panel |
| Provider-only setting | Backend option | Radio control did not affect requests | Working per-user provider-only mode; no simulated outage fallback |
| Units and profile preferences | Device persistence | Partly implemented | Persistent profile/units; map follows units; weather mode also persists |
| Exercise duration, intensity and preferred hours | Working | Basic workout window | Full planner retained |
| School drop-off/pickup planning | Working | Current-rain alert | Full interval-based planner retained |
| Event date, duration, shelter and comfort | Working | Simple comfort value | Full planner retained |
| Crop, region and planting date | Three sourced combinations | Generic farming insight | Sourced calendar and forecast caution retained |
| Journey, airport weather, traffic and tides | Working optional integrations | Traffic/tide placeholders | Existing endpoint forecasts, METAR/TAF, optional TomTom/WorldTides retained |
| Offline app shell and exact-query cached data | Working | Not implemented | Retained, with explicit offline map state |
| Notifications | In-app reminders | Disabled placeholder | In-app reminders and inbox; background push is not implemented |
| Accounts/profile endpoints | Device-local, no login | Shared global in-memory profile | Device-local preferences; a shared server-wide profile is not treated as a user account |

## How to use the additions

1. Start the app using the existing launcher instructions in `README.md`.
2. Click **Explore weather map** on the homepage, **Weather map** in the sidebar, or **Map** on mobile. The map loads automatically when the explorer opens; choose a layer to update it. The map uses Windy's own data and timeline; changing Judge Mode does not simulate its imagery.
3. Click the location name. Choose **India: village, district or PIN code**, enter the place and press **Search**. Select a result. Worldwide city search remains available in the same dropdown.
4. Click **Use my current location** for a rounded GPS coordinate and reverse place name. If naming fails, the coordinate remains usable.
5. Click the bell for the advisory inbox. **Mark all as read** clears the unread count, not the advisories themselves.
6. In **Preferences → Weather mode**, choose **Providers only · no simulated fallback** to receive an unavailable state when usable provider/cache data cannot be obtained. Cached provider estimates can still be used within their expiry limit. Judge Mode explicitly overrides this with demo data while enabled.
7. Open **Data details** to inspect the new pressure, dew point and wind-direction values with their sources and valid times.

## Provider and integration notes

- Windy branding and map attribution remain visible. The app does not cover logos or claim the map imagery as its own. An external-link fallback is available because third-party iframe availability and layer coverage cannot be guaranteed. Panning the iframe does not update the app location; use **Choose another place**.
- Detailed search uses the configurable `GEOCODER_URL` Photon server, serialized requests and a bounded one-day memory cache. Calls occur after user search/GPS actions, not on every keystroke. The public demo server has no availability guarantee and is for moderate usage; deploy a private Photon service for larger loads. City search remains Open-Meteo.
- The uploaded public Nominatim dependency was replaced with Photon. The Nominatim public service has specific informed-use restrictions; it is not silently configured here as a generic app geocoder.
- India results use Asia/Kolkata. For GPS outside India, the device timezone is an initial fallback until the weather provider supplies the location timezone. Original rounded GPS coordinates are retained rather than replaced with a nearby address coordinate.
- Pressure is surface pressure in hPa, dew point is a provider hourly estimate in °C/°F, and wind direction is degrees. They are never substituted with arbitrary live defaults. Demo values are explicitly simulated.
- All existing scientific and operational limits remain: rules are not trained ML; official IMD warnings, cloud accounts, flight delays, full-route weather, and background push are not connected. Traffic and tides require credentials for live results. Pollen coverage remains European.

## Reading the code

Start with `docs/CODE-REVIEW-1.2.md`. New files are `components/WeatherMap.jsx`, `components/LiveClock.jsx`, `components/AlertInbox.jsx`, `services/map.js`, and backend `services/locations.py`. The existing API schema is reused throughout. The source is organized for a student team to read and modify; code authorship is not inferred from formatting or length.

## Sources

- Windy embed configuration: https://embed.windy.com/config/map
- Photon project and public server usage: https://github.com/komoot/photon
- Photon API: https://github.com/komoot/photon/blob/master/docs/api-v1.md
- OpenStreetMap attribution: https://www.openstreetmap.org/copyright
- Open-Meteo weather fields: https://open-meteo.com/en/docs
- Nominatim public service policy: https://operations.osmfoundation.org/policies/nominatim/

Category references: https://www.airnow.gov/aqi/aqi-basics/ and https://www.epa.gov/sunsafety/uv-index-scale-0
