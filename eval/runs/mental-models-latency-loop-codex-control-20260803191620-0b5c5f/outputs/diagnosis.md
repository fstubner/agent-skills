# Latency incident diagnosis

## Conclusion

The primary cause was the `recommendations_checkout` rollout from 10% to 60% at 09:45. The feature note says each enabled checkout adds one database query, and the metrics show recommendation queries per checkout increasing from 0.2 to 1.2. Under the concurrent campaign load, that extra database work saturated the database pool. Client retries then amplified the load and prolonged the incident.

The safest first action, if the incident is active, is to set `recommendations_checkout` back to 10% (or disable it if the control is not granular), then confirm pool utilization and checkout p95 are falling. This is a reversible configuration change targeted at the correlated change. A broad API rollback is not the first action supported by the evidence: API v184 was deployed at 09:15, but checkout p95 was still 310 ms at 09:28.

## Evidence

All times below are from the incident timeline; metric values are from the accompanying metrics table.

| Time | Observation | Diagnostic significance |
|---|---|---|
| 09:15 | API v184 deployed | Candidate change, but not temporally sufficient by itself. |
| 09:28 | Checkout p95 310 ms | Latency remained near baseline after the API deploy. |
| 09:44 | Campaign traffic began; RPM rose from 1,000 at 09:40 to 2,300 at 09:46 | Increased load was a stressor and likely reduced spare capacity. |
| 09:45 | `recommendations_checkout` rollout changed from 10% to 60% | Directly precedes the sharp degradation. |
| 09:46 | Recommendation queries/checkout 1.2; DB pool 78%; p95 420 ms | Database work and saturation begin moving with the rollout/load. |
| 09:47 | Checkout p95 exceeds 900 ms | User-visible incident begins. |
| 09:49 | DB pool exceeds 95%; p95 940 ms; retry rate 8% | Pool exhaustion is concurrent with severe latency; retries are increasing. |
| 09:52 | DB pool 99%; p95 1,480 ms; retries 19% | Peak saturation and retry amplification. |
| 10:04 | Feature restored to 10% | Targeted mitigation begins. |
| 10:05–10:10 | Queries/checkout fall to 0.2; pool falls 71% to 55%; retries 12% to 2%; p95 falls 780 ms to 340 ms | Recovery follows removal of the extra database work. |

## Causal chain

1. Campaign traffic more than doubled request volume, from about 1,000 to 2,300 requests/minute.
2. The feature rollout increased the average recommendation query count from 0.2 to 1.2 per checkout—approximately six times the prior feature-related query rate and one additional query per enabled checkout, as stated in the feature note.
3. The combined load pushed database-pool utilization from 41% at 09:40 to 78% at 09:46, then 96–99% during the latency peak.
4. Queueing at the saturated pool increased checkout latency from 315 ms at 09:40 to 1,480 ms at 09:52.
5. The stated retry policy retries twice when checkout exceeds 800 ms. As p95 crossed that threshold, retry percentage rose from 1–3% to 19%, adding work while capacity was already constrained.
6. Restoring the feature to 10% reduced recommendation queries to 0.2/checkout, after which pool utilization, retries, and p95 all returned toward baseline. This recovery is consistent with the feature rollout being the trigger and the retry behavior being an amplifier.

## Why this is the leading diagnosis

The timing, mechanism, and recovery all agree. The API deploy is weakened as the primary hypothesis by the 13-minute healthy interval after deployment. Traffic alone is insufficient as the explanation: it increased around the same time, but the sharp step in recommendation queries and the subsequent recovery occurred when the feature percentage changed. The retry policy explains why the peak worsened after the initial database saturation; it does not explain the initial increase in database work.

This is a layered diagnosis rather than a single-factor claim:

- Trigger: feature rollout increased database queries per checkout.
- Contributing stressor: campaign traffic increased request volume.
- Amplifier: retries on requests exceeding 800 ms.
- Resource bottleneck: database connection pool saturation.

## Safest first action and verification

1. Set `recommendations_checkout` to 10% immediately; if the flag is not safely adjustable, disable it.
2. Watch, at one- to two-minute intervals, checkout p95, DB pool utilization, retry percentage, requests/minute, and recommendation queries/checkout.
3. Success criteria: recommendation queries return near 0.2/checkout; pool utilization declines materially below saturation; retries fall; checkout p95 approaches the pre-incident 310–340 ms range.
4. If the pool remains saturated after the flag change, pause or reduce the campaign traffic and investigate other concurrent database consumers. Do not increase retries or make a broad code rollback before confirming the targeted mitigation.

The timeline says this mitigation was already applied at 10:04 and that the service recovered by 10:10. That is evidence the action is effective, but it should still be treated as a reversible mitigation until the feature's query behavior and capacity envelope are fixed.

## Remaining uncertainty / challenge tests

The supplied material does not include per-request traces, query latency, pool wait time, error rates, or a control cohort. An engineer challenging this diagnosis should check:

- whether non-checkout endpoints or unrelated queries showed the same latency increase;
- whether pool wait time, rather than database execution time, dominated checkout latency;
- whether the 10% cohort stayed near baseline while the 60% cohort degraded;
- whether retry requests were counted in the same RPM and p95 series;
- whether any independent database or infrastructure change occurred at 09:44–09:49.

Those checks could refine the attribution between campaign load and the feature, but they would not invalidate the immediate low-risk mitigation supported by the observed recovery.

