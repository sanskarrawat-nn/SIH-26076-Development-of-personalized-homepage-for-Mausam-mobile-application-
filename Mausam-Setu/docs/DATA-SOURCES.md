# Data sources and provenance

Reference documentation checked on 24 September 2026:

- Weather: https://open-meteo.com/en/docs
- Air quality: https://open-meteo.com/en/docs/air-quality-api
- Marine: https://open-meteo.com/en/docs/marine-weather-api
- Locations: https://open-meteo.com/en/docs/geocoding-api

Weather uses `/v1/forecast` with best_match, then gfs_seamless. Both attempts use Open-Meteo: **the secondary attempt is model redundancy, not an independent vendor or outage domain**. Optional CAMS air and marine requests run independently. Marine requests are made only when the marine persona is selected. The API current AQI is **US AQI**, explicitly not India's NAQI. No AQI conversion or pollutant fabrication occurs.

Current Open-Meteo conditions are model-derived and labeled **Estimated**. The `live` mode means an online provider attempt; it does not force the `live` metric status. The status enum supports real observations for a future observation adapter but this build does not generate them.

## Freshness and fallbacks

Fresh cache reuse: 15 minutes. Maximum offline-provider cache age: 3 hours. Cache use changes every non-missing metric to Cached. Expired provider snapshots cannot generate weather advice. Browser offline data shows Cached (or Demo if originally simulated) and expires real recommendations using their expiration timestamps.

Fallback order: primary model → secondary model → valid cache → unavailable. Automatic demo fallback is disabled, including when a legacy `DEMO_FALLBACK=true` environment variable exists. A missing AQI or marine source never destroys weather availability. Soil moisture at 0–1 cm and 3–9 cm is fetched independently. European grass/birch/alder pollen is fetched optionally; India pollen is unavailable. Tide and traffic adapters are on-demand and require keys. Official IMD warnings and road-closure lists remain unavailable. No satellite integration is claimed.

Simulated scenarios use fixed values and a fixed reference date. Demo values are designed for reproducible engineering tests, not scientific observations. Sources are displayed in the status ribbon, explanations and per-metric data table. Retrieval time does not equal observation or forecast-valid time.

## Online checks (25 September 2026)

Weather, soil moisture, CAMS air, Goa marine data, Berlin pollen and a recent Lucknow airport METAR were retrieved successfully. The environment required a SOCKS transport dependency and longer timeout during checks. See `qa/online-providers.json` and `qa/aviation-provider.json`. Default request timeout is 15 seconds; tests of online providers allowed 25 seconds. Actual hosting egress, quotas and reliability still need deployment acceptance checks. Traffic and tides have not been tested with account credentials. The documented IMD district-warning endpoint returned HTTP 401; no official warning ingestion is claimed.

Attribution: Open-Meteo, contributing national weather services, CAMS for air quality, DWD and Open-Meteo for marine. Review current licensing, attribution and commercial-use terms before publishing a commercial service.
