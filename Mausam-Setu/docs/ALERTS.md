# Weather advisories

App-generated advisories are not official IMD warnings. They are shown in a distinct area from recommendations and remain independent of selected personas.

Configured policies check temperature, current forecast UV, rain probability, wind, visibility, US AQI and freezing temperature. Each alert has a stable type/location ID, severity, location, start/end time, message, triggering reason, source and status. The current rules emit caution/warning; the contract also supports info/severe for future policies. An advisory expires after one hour.

Deduplication: one advisory per type and rounded location per generation. Reminders are optional, in-app only, and use device storage to enforce a one-hour type/location/status cooldown. Expired reminder history is removed after 24 hours. No push notification or background service is represented as connected. `notification_due` is reserved in the API model; the actual current reminder decision belongs to the browser.

A missing field does not create an alert. Missing official warnings are not displayed as “no official warnings.” Absence of a rule match does not establish safety. Demo advisories retain Demo status.

## Advance advisories (1.1)

The engine now scans the next 48 hours for the first forecast heat, freezing, rain, low-visibility and thunderstorm-code match. Each advance advisory identifies its forecast period and is labelled app-generated. Forecast advisories retain the source status. Offline data older than the three-hour maximum loses all recommendations, planning assessments and advisories even if a future event has not occurred yet.
