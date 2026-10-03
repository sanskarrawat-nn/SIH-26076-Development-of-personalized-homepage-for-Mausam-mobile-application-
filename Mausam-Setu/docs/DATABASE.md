# Database and upgrades

SQLAlchemy supports SQLite locally and PostgreSQL in deployment. `weather_snapshots` contains reusable provider payloads, keys and timestamps. `community_observations` contains public coarse report JSON, private moderation evidence, a hashed deletion token and indexed expiry. Profiles, contact lists, learning and saved plans remain on the device.

Application startup calls `Base.metadata.create_all` after importing the community model. This creates absent tables; it does not modify existing columns. Parts 2 and 3 use the same SQL table shapes. Part 3 adds duplicate fingerprints and submission timestamps inside existing private JSON; older rows lacking these fields remain readable and are excluded from exact duplicate matching.

## Upgrade from Part 1 or 2

1. Stop writes and take a database backup. For SQLite, stop the server before copying `backend/mausam.db`; for PostgreSQL use the hosting platform's backup/export process.
2. Keep the same `DATABASE_URL`; install the updated requirements and code.
3. Start the application. Missing community tables are created; existing snapshots and reports remain intact.
4. Check `/ready`, a demo homepage, report listing and receipt deletion on a test report.
5. If rolling back, restore the prior code and, if required, the matching backup. Never delete the production database to repair a migration.

No SQL column migration is needed for this release. There is no Alembic revision history yet; future column changes require a reviewed versioned migration and restore rehearsal before deployment. PostgreSQL configuration is supported but a hosted PostgreSQL upgrade was not executed in this environment.

## Retention and operational limits

Snapshot pruning occurs on successful writes using `CACHE_MAX_SECONDS`. Community records disappear publicly at expiry; private records older than expiry plus one day are purged opportunistically on report reads/submissions. An inactive service may retain expired rows until the next operation. Deployment operators should schedule cleanup if strict wall-clock deletion is required.

Deletion receipts authorize removal and are stored only in the submitting browser. The server stores SHA-256 token hashes. Clearing browser data removes receipts, not submitted records; the UI explains this before reset. A privileged operator can remove stored evidence through an audited operational procedure.

Duplicate detection compares normalized text, sanitized photo, category and rounded cell within ten minutes. It is bounded prototype abuse control, not identity verification or an atomic cross-worker uniqueness guarantee. Use a shared limiter and transactional uniqueness policy before running a high-volume multi-worker public submission service.

Database exceptions return recoverable 503 responses without connection strings or queries. `/ready` reports an unhealthy database. Startup cannot serve normal traffic if initial schema creation fails; repair configuration/storage and restart.
