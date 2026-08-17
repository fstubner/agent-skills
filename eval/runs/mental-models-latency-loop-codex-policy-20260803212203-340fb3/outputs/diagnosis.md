# Latency incident diagnosis

## Conclusion

The most likely primary cause was the `recommendations_checkout` rollout from 10% to 60% at 09:45. The change adds one database query for each enabled checkout. During the incident, average recommendation queries per checkout rose from 0.2 to 1.2, while traffic was already about 2.3 times the 09:40 level. This pushed database connection-pool utilization from 78% at 09:46 to 96–99% at 09:49–09:52, which is consistent with queueing and the checkout p95 rising from 420 ms to 940 ms and then 1,480 ms.

The retry policy was a secondary load amplifier: it retries twice when checkout exceeds 800 ms. As latency crossed that threshold, retry traffic rose from 8% at 09:49 to 19% at 09:52, increasing demand on an already saturated pool. It was not the initiating event because retries increased after the latency and pool-utilization increase.

## Evidence and reconstruction

The following observations are taken only from `incident/timeline.txt`, `incident/metrics.csv`, and `incident/changes.txt`.

| Time | Relevant observation | Interpretation |
|---|---|---|
| 09:15 | API v184 deployed | Candidate change, but not temporally proximate to degradation. |
| 09:28 | Checkout p95 remained 310 ms | System was healthy 13 minutes after v184. |
| 09:44 | Campaign traffic began | Requests rose from 1,000/min at 09:40 to 2,300/min at 09:46. |
| 09:45 | `recommendations_checkout` changed from 10% to 60% | Directly precedes the query-rate increase. |
| 09:46 | 1.2 recommendation queries/checkout, DB pool 78%, p95 420 ms | New database work appears immediately after rollout. |
| 09:49 | DB pool 96%, retry 8%, p95 940 ms | Pool saturation and threshold-triggered retries coincide with severe latency. |
| 09:52 | DB pool 99%, retry 19%, p95 1,480 ms | Positive feedback: slow checkouts cause more requests, further increasing contention. |
| 10:04–10:10 | Rollout restored to 10%; pool falls below 60%; p95 returns to 340 ms | Strong rollback/recovery evidence for the feature rollout as the principal cause. |

Quantitatively:

- Request rate increased from 1,000 to 2,300 requests/min (+130%) when campaign traffic began.
- Recommendation queries per checkout increased from 0.2 to 1.2 (+1.0 query/checkout, or 6x the prior average) after the 60% rollout.
- The combined additional database-query rate attributable to this feature is approximately `2,300 * (1.2 - 0.2) = 2,300` queries/min, before counting retries.
- p95 increased from 315 ms at 09:40 to 1,480 ms at 09:52 (+1,165 ms, about 4.7x).
- After the flag was restored to 10%, query rate returned to 0.2, pool utilization fell from 99% to 55%, and p95 returned to 340 ms. That recovery is a controlled natural experiment, although the campaign traffic remained elevated, so it does not prove that no other factor contributed.

## Causal model

`campaign traffic` + `60% recommendations rollout`
→ more checkouts and approximately one extra DB query per checkout
→ DB pool contention/saturation
→ checkout queueing and p95 above 800 ms
→ retry policy issues additional checkout attempts
→ more DB contention and still higher latency

## Safest first action

Restore `recommendations_checkout` to 10% immediately (or disable it if the flag cannot be set to 10%), using the existing flag-control path and verifying the change took effect. This is the smallest, reversible action supported by the evidence, and the timeline already shows that the same action was followed by recovery.

Immediately monitor, at minimum, checkout p95, DB pool utilization, recommendation queries per checkout, request rate, and retry percentage for several minutes. The expected signs of success are recommendation queries near 0.2/checkout, pool utilization continuing below the saturation range, retries declining, and p95 returning toward the pre-incident range.

Do not start by changing the database pool size or deploying a code rewrite: those actions are slower, less reversible, and could hide the load problem or increase database risk. Once stable, separately consider disabling or tightening retries while investigating why the added query is not capacity-safe.

## Alternatives considered

- **API v184 as the primary cause — unlikely.** It was deployed at 09:15, and checkout p95 was still 310 ms at 09:28. The change notes say the response-field rename retained a compatibility alias; there is no evidence here of a latency-producing path change.
- **Campaign traffic alone — insufficient.** Traffic increased before the incident and likely consumed headroom, but the sharp increase in recommendation queries occurs with the 09:45 rollout. After the rollout was reduced, p95 and pool utilization recovered despite traffic remaining around 2,250–2,280 requests/min.
- **Retries as the initiating cause — unlikely.** Retry percentage follows the p95 and pool-utilization increases and is explicitly triggered by checkout latency over 800 ms. It materially amplified the incident but does not explain the first degradation.
- **An unrelated database failure — not supported by these artifacts.** Pool utilization and latency recover after the feature rollback; there is no independent error or outage signal in the supplied files. This remains an uncertainty because no DB error, query-latency, or pool-wait breakdown is provided.

## Remaining uncertainty and follow-up

The supplied data is aggregate and sampled at minute resolution. It does not establish query execution time, pool wait time, error rate, retry request volume versus retry percentage, or whether the campaign changed checkout mix. Validate the diagnosis with DB wait/slow-query data partitioned by query shape and flag state, plus checkout request and retry counts. Also confirm that the 09:45 flag change was fully propagated and that no other deploy or configuration change occurred in the same interval.

