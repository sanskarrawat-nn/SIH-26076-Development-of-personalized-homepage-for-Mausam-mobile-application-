# Using Part 2

Run the existing `start-windows.bat` on Windows, or the documented backend/frontend commands in README. Reinstall backend requirements to obtain Pillow. Database tables are created at backend startup. Use persistent PostgreSQL or persistent SQLite storage for reports on deployment.

## Quick demonstration

1. Open Judge Mode and choose **Student Commute**. Inspect Your student day, the three schedule windows and Why this for me.
2. Choose **Hill Fog** to see visibility cautions. There is no landslide prediction.
3. Choose **Community Flood Report**, then Report map and a numbered marker. Choose **Verified Community Report** to contrast a simulated human review with unverified evidence.
4. Choose **Route Heavy Rain**, open Journey & airport weather, set valid 15–21 June 2026 times and Check journey. Geometry/totals are marked simulated; five weather samples have approximate ETAs.
5. Under Weather-aware plans, save an event within the demo week. Check full-duration weather and indoor backup.
6. Click Useful/Not Useful, then inspect relevance explanations. Reset or disable learning in Privacy and notifications → Device preferences.
7. Enable Low Data Mode, open the weather map, and see the explicit suppression notice. Turn it off to restore normal automatic loading.
8. Select Emergency or Severe AQI; safety stays first even with low preference weights. Hindi Voice changes the interface language; Ask Mausam supports typed fallback.

## Real community report

Leave Judge Mode and select provider mode. Choose the report location in Places (GPS is optional and can be disabled). Open Conditions around you → Report local weather. Choose the category, recent observation time, description and optional evidence photo. Never include personal information or identifiable people/addresses in evidence unnecessarily.

Submission returns a private deletion receipt saved on this device. Public readers receive only coarse coordinates and a placeholder description until review. Your text/photo is visible only to the configured reviewer endpoint. Deleting a report requires its receipt. The demo form cannot post fake observations into the real database.

## Human review API

Set a long random `COMMUNITY_REVIEW_TOKEN` on the backend; use HTTPS and keep the token out of URLs, frontend code and logs. The reviewer must independently check evidence and remove private details before entering public text.

- `POST /api/community/review-queue`, JSON `{ "token": "operator secret" }`, returns up to 50 active reports with private evidence.
- `POST /api/community/reports/{id}/review`, JSON fields: `token`, `verified` (boolean), `public_description`, `evidence_note` (20–500 characters), `privacy_checked` (true only after human review).
- `verified: true` changes the label to VERIFIED LOCAL REPORT, attributed to a local project reviewer, never government verification.
- `POST /api/community/reports/{id}/delete`, JSON `{ "token": "deletion receipt" }`, removes the report.

The reviewer endpoint does not publish private images. It requires a separate manual redaction/publication workflow before any such extension. Blank review configuration rejects all review requests. Do not expose the reviewer secret to public clients.

## Background notification deployment contract

The shipped app can show service-worker notifications when browser permission is granted and the page evaluates fresh conditions. It stores preferences and sent receipts locally. Simulated, cached, expired and unavailable candidates are rejected. A serialized sender prevents simultaneous modules from duplicating a notification.

`backend/app/services/notifications.py` defines the validated candidate, preferences, eligibility policy and transport interface. `frontend/public/sw.js` receives future push messages and opens the app on click. It ignores expired/non-live payloads and never opens arbitrary payload URLs.

A future deployed worker needs:

1. An opt-in subscription API, VAPID public/private keys and encrypted subscription storage, associated with a revocable user/device token.
2. A durable job scheduler evaluating saved schedules and authoritative/provider warnings with location/time validity.
3. A transactional receipt ledger keyed by subscription + category + candidate ID; apply consent, severity, expiry and cooldown before reserving a send. Separate demo and real environments.
4. A Web Push transport implementation, removal of expired subscriptions on provider 404/410, bounded retries, and an unsubscribe endpoint. Android FCM can implement the same candidate/transport contract.
5. End-to-end browser/device delivery tests. An accepted send does not guarantee the OS displays it.

These deployment components are **not supplied as a running background service**. The UI explicitly states that limitation. Do not advertise closed-app alerts until those components exist and are tested.

## Provider contracts

TomTom route geometry uses Calculate Route v1, `routeRepresentation=polyline`, a supported travel mode, departure time and traffic-aware totals. The app samples the returned geometry by cumulative distance; it does not invent a road route when access fails. Demo routes are explicitly synthetic. Source: https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route

Hourly air quality from the existing Open-Meteo request is attached only at matching weather timestamps. No current AQI is copied into a future hour. Missing coverage prevents a complete AQI assessment.

Optional configured emergency contacts use `EMERGENCY_CONTACTS` as a JSON array. Every entry requires `name`, `phone`, `area`, `source_url`, and an ISO timestamp `checked_at`. Supply only contacts the operator actually verified from the listed source. No speculative local numbers are preloaded.
