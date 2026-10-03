# Architecture and native integration

The product has one provider normalization path and one `compose(bundle, profile)` path. The legacy web endpoint and versioned native endpoint call the same composition function. There is no duplicated native risk engine or persona policy.

1. Validate selected coordinates/timezone, interests, activity, plans and manual/learned weights.
2. Fetch or reuse a normalized weather bundle. Attach only validated official warnings from configured server-side adapters.
3. Calculate the six-hour heuristic risk and independent critical/official safety overrides.
4. Build persona recommendations and schedule windows. Rank using actual score components; bounded adaptive weights affect preference only.
5. Build ordered widget definitions with title, reason, priority, provenance, expiry and actions.
6. For native context, fetch community observations independently. A community storage failure returns unavailable community context without removing available weather.
7. Render actions through the web UI or a future native client. Foreground notification filtering and bounded voice intents reuse returned data.

## Contract v1

`GET /api/integration/v1/context` accepts the same validated query parameters as `/api/home/personalized`. Example:

```text
/api/integration/v1/context?latitude=26.8467&longitude=80.9462&name=Lucknow&timezone=Asia%2FKolkata&interests=fitness,health&mode=demo&scenario=heat
```

| Response key | Meaning |
| --- | --- |
| `schema_version` | `1.0`; clients should explicitly support a version |
| `user_context` | Validated location, profile and reference time |
| `weather` | Current, hourly/daily, air, marine and data-status records |
| `weather_risk` | Numeric heuristic, per-component contributions, missing coverage, expiry |
| `safety` | Emergency flag, independent hazards and applicable official warnings |
| `official_alerts` | Applicable validated warnings; demo fixtures remain simulated |
| `homepage_layout` | Ordered renderer-independent widget definitions |
| `recommendations` | Explained actions with measured inputs, score breakdown and rule metadata |
| `planning` | Derived activity, schedule and crop/coastal windows |
| `priority_alerts` | App-generated advisories, separate from official warnings |
| `community_conditions` | Nearby active public reports; no private photos, deletion tokens or unreviewed text |
| `community_status` | Retrieval metadata, explicit outage or demo separation |
| `data_sources` | Provider configuration registry; configured does not mean a successful live fetch |
| `generated_at` | Composition timestamp; use per-metric timestamps for freshness |

Widget `data.section` identifies the relevant section payload. A native client maps `widget_type` to its own view; `widget_id`, `priority`, title/subtitle, reasons, severity, source, status, last update, expiry and action IDs remain framework independent. For example, `forecast` consumes `weather.hourly/daily`; `plans` consumes `planning`; `community` consumes `community_conditions`; `insights` consumes `recommendations`; `safety` consumes `safety` and `official_alerts`. No HTML/CSS or React imports are required by the API.

Native clients must respect expiry, show status/source, retain mandatory safety sections, implement accessible fallback for unknown widgets and never relabel simulated data. In demo mode the unified endpoint intentionally excludes live community reports; the web Judge community fixtures are separate explicit UI fixtures. Native community fixtures would be a future client feature.

## Official application boundary

This is an integration-ready service contract, not proof of official Mausam access. Deployment inside an official app requires authorization, provider-specific payload mapping, district/polygon resolution, identity/security design, operational testing, release governance and client integration. No official credentials or invented endpoint are supplied.

## Scores and learning

Weather risk is a capped screening index using worst available inputs in six hours. It is not an official warning index, a calibrated probability or trained ML. Critical triggers can activate safety even when the aggregate score is low. Relevance combines the stored `score_breakdown` components; totals are capped, so raw components can sum above a displayed 100. Negative adaptive values reduce relevance; the UI shows signed contributions.

Manual weights and device-learned weights are separate. Feedback and explanation-open signals update bounded persona weights and three-hour time buckets. Disable/reset removes their effect. No cloud history, image recognition, general LLM, model training or prediction accuracy percentage is claimed. Community reports never alter numeric weather risk.
