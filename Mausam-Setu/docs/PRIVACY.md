# Privacy and user controls

The app stores profile/interests, schedules, selected/saved/recent places, units, language, accessibility, five saved plans, device contacts, bounded feedback weights, alert read/cooldown records, report deletion receipts and cached responses on this browser. There is no cloud account or cross-device synchronization.

Preferences provides profile editing and device reset. Privacy and notifications provides low-data mode, GPS-request opt-out, learning disable/reset, recent-history clearing and notification preferences. Saved places and saved plans can be removed individually. Browser site settings control previously granted OS notification, microphone and location permissions; switching an application toggle cannot revoke the OS permission itself.

GPS starts only after user action and browser permission. Coordinates are rounded before geolocation weather queries; GPS selections do not enter automatic recent-city history. Explicitly saved locations persist until removed. No background tracking occurs.

Weather queries send coordinates and relevant preferences to the backend. Shared weather caches contain location metadata, not an account identity; expiry is bounded by configuration. Routing sends origin/destination and departure time to TomTom when requested/configured. Tide lookups send coordinate/date to WorldTides; airport lookups send ICAO codes to NOAA. Detailed search sends text or rounded coordinates to the configured Photon service. Opening the weather explorer immediately sends selected coordinates to Windy; no separate load button is required. Low-data mode prevents that external map load.

Speech recognition may use the browser vendor's remote speech service. The microphone starts only by user gesture. Speech support varies; typing and readable answers remain available. No voice recordings are stored by this application.

Community storage retains rounded coordinates, category, timestamps, public status and private moderation evidence. Arbitrary location names and exact report coordinates are not stored. Images are re-encoded to strip EXIF and embedded metadata. Text/photos are not automatically safe or authentic; human privacy review is required, and photos remain private. Public expiry is four hours after observation; physical cleanup is opportunistic after expiry plus one day. See DATABASE.md for details.

**Deleting browser data does not delete submitted reports.** Use each saved report receipt first. Reset removes local preferences and weather-response caches. The static service-worker shell contains application assets and remains installed; use browser site-data controls to remove it. Reset cannot erase records held by external providers or hosting logs. Configure their retention separately. Losing a deletion receipt removes browser-based proof of ownership; do not promise account recovery.

Learning uses bounded persona feedback and time buckets on this device. It is not identity profiling, cloud model training or medical inference. General sensitivity choices are transmitted for environmental screening; do not enter diagnoses or sensitive medical history.
