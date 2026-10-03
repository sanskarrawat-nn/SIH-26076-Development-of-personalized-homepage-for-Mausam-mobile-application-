# Provider configuration and provenance

This matrix describes implemented adapters and configuration, not verified current external service uptime, licensing or quota entitlements. Confirm provider terms and account quotas before operating publicly. `/api/providers` exposes configuration state; per-metric status determines actual request provenance.

| Provider | Purpose | Key/config | Current connection | Failure/coverage boundary |
| --- | --- | --- | --- | --- |
| Open-Meteo weather | Current/hourly/daily, soil | No key in implemented public adapter | Callable adapter | best_match → GFS model → valid cache → unavailable; same upstream provider |
| Open-Meteo CAMS | US AQI, particulate matter, regional pollen | No key in implemented public adapter | Callable adapter | Estimated US AQI, never Indian NAQI; India pollen unavailable; missing hours stay missing |
| Open-Meteo Marine | Waves, period, water temperature | No key in implemented public adapter | Callable adapter | Suppress returned sea grid over 30 km away; not tide/harbour validation |
| Open-Meteo Geocoding | City search | No key | Callable adapter | Search failure suggests saved/predefined places |
| Photon | Detailed India search/reverse lookup | `GEOCODER_URL` | Public default configured | User-triggered queries; bounded cache; use an operator-approved/self-hosted endpoint for volume |
| NOAA Aviation Weather | METAR/TAF | No key in adapter | Callable adapter | ICAO and coordinate checks; no flight status/delay or airport clearance |
| TomTom | Traffic duration/route geometry | `TOMTOM_API_KEY` | Key absent by default | Optional; unavailable without key; five sampled route points when geometry exists; bus unsupported |
| WorldTides | Predicted extrema | `WORLDTIDES_API_KEY` | Key absent by default | Coastal screen; estimated tides, no wave-to-tide inference |
| IMD | Official forecasts/nowcasts/warnings | Authorized loader + mapping | Unconfigured | Explicit unavailable; website link is not warning ingestion |
| CPCB | Indian NAQI | Authorized loader + station mapping | Unconfigured | No conversion from US AQI |
| INCOIS | Official marine/coastal information | Authorized loader + mapping | Unconfigured | No invented tide/coastal warning |
| ICAR | Regional crop advisories | Authorized loader + mapping | Unconfigured | Generic crop screening remains separate |
| NDMA | Disaster advisories | Authorized loader + mapping | Unconfigured | No official endorsement or fabricated bulletin |
| Windy | Independent external weather explorer | No key for existing iframe | Loads after user opens map | Sends selected coordinates; external coverage/timestamps; never driven by Judge fixtures; unavailable offline/low-data |

Configured public adapters have timeouts, caching and finite request scope; the application does not encode a contractual free quota. Route screening makes five weather lookups; shared provider cache/dedup reuse repeated locations. Air/soil/marine extensions are shared, not fetched once per persona.

**Labels:** observed `live` only for genuine observations; model/prediction `estimated`; stored valid response `cached`; explicit fixture `simulated`; absent/expired data `unavailable`; citizen reports retain their local community verification state. A provider being configured is not a LIVE badge. A project-reviewed report is not an official warning.
