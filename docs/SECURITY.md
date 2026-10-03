# Security controls and limits

Backend secrets are read from environment variables; `.env` and databases are excluded from the archive and git. `VITE_API_BASE_URL` is a public build-time origin, never a secret. Provider URLs are fixed except the operator-configured geocoder; user-submitted URLs cannot select arbitrary fetch targets.

Pydantic validates coordinates, timezone, persona/mode/scenario, weight ranges, schedule fields, durations and text lengths. Official warning sources require HTTPS without URL credentials. Provider normalization checks identity, requested location and validity. User/community routes cannot manufacture official warnings.

CORS allows only configured origins and GET/POST. Response headers include nosniff, strict-origin referrer policy and no-store. Frontend hosting adds frame denial and capability policies; microphone/geolocation remain permission-controlled. TLS and trusted origin configuration are deployment responsibilities.

## Abuse and uploads

- Default global limit: 90 requests/minute per actual peer IP in the process.
- Community submission limit: five attempts per ten minutes per peer, including invalid attempts.
- Both limiters ignore untrusted forwarded IP headers. A reverse proxy can group visitors; deploy an edge/shared limiter using a verified proxy configuration for production scale.
- POST bodies are capped at 3 MB before JSON/image parsing, including chunked bodies without Content-Length.
- Photos accept decoded JPEG/PNG/WebP only, at most 2 MB and 12 megapixels. Pillow re-encodes pixel data, strips metadata and resizes to a 1000-pixel maximum dimension. MIME claims/filename extensions alone do not establish validity.
- Text and photos stay private pending human review. React renders text rather than inserting HTML. Photos remain private after text review; no automated face/address anonymization is claimed.
- Duplicate report fingerprints reject matching category/cell/normalized text/photo within ten minutes. Nearby reports do not increase confidence without independent verification.
- Reviewer access requires a configured long random secret. Report deletion requires the submission receipt; only its hash is stored. There are no pretend accounts or default admin credentials.

## Logs and operations

Application logs contain event name, latency and error class, not request bodies, raw provider responses or database connection strings. Uvicorn access logging is disabled. Configure platform/proxy logs to redact coordinates, profile query strings and credentials. SQL storage failures return generic retryable 503 responses.

This is not a penetration-tested public emergency service. Distributed rate limiting, reviewer identities/audit trail, identity-backed moderation, a formal threat model, dependency advisories, trusted deployment headers, retention enforcement, load testing and backup/restore rehearsal remain production work. No dependency security audit or certification is implied by unit/build/browser tests.
