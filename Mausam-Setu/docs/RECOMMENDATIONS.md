# Recommendations and calculations

Recommendations are distinct from alerts. They describe actions to consider, and include source, status, timestamp, expiration, quality, reasons, personas, displayed metrics and component scores.

## Activity windows

`recommendations/planning.py` evaluates each full user-selected session against hourly coverage, daylight and preferred hours. Exercise type controls wind limits; intensity changes the feels-like ceiling. Rain, humidity, UV and visibility limits must pass. Current AQI is checked when available, with an earlier threshold for air sensitivity. The best worst-hour comfort score selects among eligible sessions; earliest time breaks ties. The original two-hour helper remains a tested legacy utility but no longer drives the homepage fitness rule.

This is an explainable scheduling heuristic, **not a validated physiological comfort model**. Future hourly AQI is not incorporated. No session is offered when coverage/daylight is missing. Candidate starts follow hourly resolution; user duration can include half-hours.

Event comfort uses the worst hourly score over the entire selected event: 100 minus a bounded temperature penalty (60), humidity penalty (20), and wind penalty (20). Rain, UV, visibility and storms remain separate concerns. A good comfort score is not an all-clear for outdoor activity.

Feels-like is supplied by the provider; this build does not invent a heat-index formula. Rain accumulation sums 24 complete hourly precipitation values and returns unavailable if any interval is missing. Provider units are canonical; client conversions use C×9/5+32 for F, km/h÷1.609344 for mph, and mm÷25.4 for inches.

## Persona outputs

- Health: current environmental exposure context, never diagnosis.
- Fitness: possible daylight activity window or explicit inability to find one.
- Travel: packing based on forecast rain, current temperature and UV.
- Family: next custom school drop-off and pickup forecast periods, plus a two-endpoint school journey planner.
- Agriculture: 24-hour forecast rainfall; reassess irrigation after checking actual soil/crop conditions. No irrigation dose.
- Commute: current rain/visibility screening plus endpoint forecasts and optional TomTom route totals.
- Marine: separate modelled sea conditions when available; no water-safety guarantee.
- Events: full scheduled event screening, worst-hour comfort and separate weather concerns; no guarantee of suitable conditions.

Recommendation expiry is one hour after its context reference time. Simulation uses its fixture clock. Offline real recommendations expire using wall-clock time.
