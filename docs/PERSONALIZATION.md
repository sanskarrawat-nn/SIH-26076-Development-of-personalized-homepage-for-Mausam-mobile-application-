# Personalization

This is a **rule-based engine**, not pre-trained ML. It implements the product's key transformation: data + selected interests + location + time + activity + data quality → explained actions.

## Ranking

Each eligible insight receives capped component contributions:

| Component | Maximum |
|---|---:|
| Selected interest | 25 |
| Weather relevance | 25 |
| Time-of-day relevance | 10 |
| Condition severity | 15 |
| Location match | 5 |
| Selected activity | 10 |
| Freshness | 10 |

The sum is normalized against configured total weight to [0,100]. Weather and severity components use a bounded rule concern value in [0,1]. Morning/evening raises family/commute temporal relevance. Selecting the corresponding activity increases activity relevance. All values and thresholds live in `core/policies.json` or in the documented policy functions.

Health and fitness share `outdoor` group identity. Their reasons and concerns merge and duplicate metrics are removed. This is a deterministic grouping approach; no arbitrary negative redundancy penalty is needed. Cards sort by descending priority with stable ID tie-breaking. The three leading insights populate Today For You; the UI initially renders up to four and collapses the rest. Advisories remain visible regardless of selected interests.

## Adding a persona

1. Add its configuration with required/optional data, metrics, rule keys, alert associations, order and explanation.
2. Implement/register the rule in `recommendations/policies.py`.
3. Extend the typed persona literal and frontend icon/label registry.
4. Add a meaningful input/output test.

The preferred-order and alert-association configuration describe persona intent; actual card ranking is determined by calculated scores, and advisories are not suppressed by persona preferences. Missing-data guards must be implemented in each policy. The current rules use daily/hourly forecast time and local day periods; they do not infer crop-specific seasonality from month alone.

## Schedule-aware planning (1.1)

Planning settings are validated separately and passed to the rules. Fitness uses user duration, intensity and hours rather than the legacy fixed two-hour helper; events have a dedicated full-duration assessment instead of reusing fitness. School periods use the configured pickup/drop-off times. Exposure flags enable additional cautious messages. The `planning` response object exposes detailed assessments; it is suppressed for unavailable or expired bundles. Planting calendars are sourced and scoped to explicit crop/region combinations. See `UPGRADE-1.1.md` for the exact current scope.
