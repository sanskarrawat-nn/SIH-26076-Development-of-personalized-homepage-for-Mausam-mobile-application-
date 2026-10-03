# Code review — 1.2

This update retains the existing app features and makes the implementation easier to maintain and explain. Naming, module boundaries and ordinary formatting were improved; code length is not a quality target.

## Changes

- Split the large planning component into form, summary, journey and tide components, with a shared request hook.
- Kept planning forms mounted during same-query background weather refreshes.
- Validated device preferences and locations before using them in requests. Storage operations recover when browser storage is blocked or damaged.
- Made shared weather requests survive cancellation by an individual client. Cache read/write failures no longer discard otherwise usable live responses.
- Used atomic database cache updates and removed unused placeholder account tables from new database initialization. Existing database tables are not deleted.
- Included timezone and six-decimal coordinates in cache keys; retained the requested place name and country. Browser geolocation still deliberately rounds coordinates before sending them.
- Rejected ambiguous and nonexistent local clock times. Measured journey and activity durations using elapsed UTC time across daylight-saving changes.
- Added timezone data for systems without an operating-system timezone database, including typical Windows installations.
- Corrected snow-shower icons and labels. Invalid numeric values and malformed timestamps cannot appear as plausible weather readings.
- Tolerated missing/short sunrise and sunset arrays from weather providers.
- Limited service-worker cleanup to this app's own caches and included the complete built shell in cache-version hashing.
- Added Python formatting/lint configuration and CI checks. Applied consistent Python and frontend formatting.

## Understanding the implementation

1. `frontend/src/App.jsx` owns the selected place, interests and navigation. Preferences stay on the device.
2. `frontend/src/hooks/useHome.js` loads the exact place/profile query, handles cancellation and refresh, and checks the saved offline response.
3. `backend/app/api/routes.py` validates request inputs and calls the weather service.
4. `backend/app/services/weather.py` coordinates cache reads, provider fallback, optional data and explicitly labelled demo fallback.
5. `backend/app/providers/` translates external responses into the models in `schemas/weather.py`. Each metric carries source, time, place and availability.
6. `backend/app/recommendations/` evaluates weather rules and planning intervals. `personalization/engine.py` merges duplicate advice, computes explainable priorities and assembles the homepage.
7. `backend/app/alerts/` creates forecast advisories. These are not connected official IMD warnings.
8. Frontend components display the result; planner POST requests have a separate cancellable request hook.

When changing a rule, identify its inputs, missing-data behavior, time horizon and explanation first. Update the policy and add a behavioral test for the changed decision. Use Judge Mode to demonstrate the result reproducibly.

## Limits

This is a reviewed prototype, not a guarantee of defect-free production operation. Existing provider, credential, scientific-validation and platform-test limitations remain in `TESTING.md` and `UPGRADE-1.1.md`. Windows startup and PostgreSQL deployment were not executed in this Linux environment. Demo fixtures and the original build directive remain documented.
