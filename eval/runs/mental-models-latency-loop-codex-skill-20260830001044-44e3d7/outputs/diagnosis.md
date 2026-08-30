# Latency incident diagnosis

## Conclusion

The incident was caused primarily by the `recommendations_checkout` rollout increasing database work during a traffic surge, with the checkout retry policy amplifying the resulting overload.

The safest first action is to reduce `recommendations_checkout` to 0% (or keep it at the already-applied 10% only if product impact makes 0% unacceptable), then watch database-pool utilization, checkout p95, and retry rate. This is a reversible configuration change on the path most directly correlated with recovery. It should precede code changes or database-pool tuning.

## Evidence and causal chain

| Time | Observation | Diagnostic significance |
|---|---|---|
| 09:44 | Campaign traffic begins | Traffic is a concurrent load change, not just an application change. |
| 09:45 | `recommendations_checkout` changes from 10% to 60% | This is the first recorded feature change immediately before degradation. |
| 09:46 | Requests/min 2,300; recommendation queries/checkout 1.2; pool 78%; p95 420 ms | Both request volume and per-checkout database work are elevated versus 09:40. |
| 09:47 | Checkout p95 exceeds 900 ms | Crosses the retry policy's 800 ms threshold. |
| 09:49 | Pool utilization 96%; p95 940 ms | Resource saturation is concurrent with severe latency. |
| 09:52 | Pool 99%; retries 19%; p95 1,480 ms | The retry mechanism is active while the constrained resource is saturated, adding work. |
| 10:04 | Rollout restored from 60% to 10% | The main excess database-work source is removed. |
| 10:07–10:10 | Pool falls below 60%; p95 returns to 340 ms; retries fall to 2% | Recovery follows the rollback while traffic remains about 2,250 requests/min, strongly supporting causality. |

The causal chain is:

1. Campaign traffic raised demand from 1,000 to roughly 2,300 requests/min.
2. At the same time, the feature rollout raised recommendation-query work from 0.2 to 1.2 queries per checkout.
3. The combined demand consumed the database connection pool (41% at 09:40, 78% at 09:46, and 96–99% at 09:49–09:52).
4. Saturation increased checkout latency past 800 ms.
5. The configured two retries increased request/database pressure, coinciding with retries rising to 19% and p95 reaching 1,480 ms.
6. Reducing the feature rollout brought recommendation-query work back to 0.2, after which pool utilization, retries, and p95 recovered even though traffic stayed high.

## Candidate causes and checks

### 1. Recommendation rollout plus traffic surge — primary cause

This has the strongest evidence. The feature explicitly adds one database query to each enabled checkout. The rollout increased from 10% to 60% just before the sharp rise, and the metric shows recommendation queries per checkout increasing sixfold from 0.2 to 1.2. The feature rollback was followed by recovery while request volume remained elevated.

### 2. Retry policy — contributing amplifier, not initiating cause

The policy retries twice above 800 ms. The threshold was crossed before retries reached 19%, so retries cannot explain the initial latency increase. They can explain why the saturated state worsened: retries add requests while the database pool is already at 96–99%. A safe follow-up is to suppress or cap retries for this failure mode once the feature load is reduced, but changing retries first is less direct than removing the added database work.

### 3. API v184 — not supported as the latency cause

The release only renamed a response field and retained a compatibility alias. The timeline shows p95 still at 310 ms at 09:28, after deployment, and no evidence ties the alias to database work or pool usage. It remains a secondary item to validate if application errors or CPU anomalies are found, but the supplied evidence does not support it as the cause of this incident.

### 4. Campaign traffic alone — insufficient explanation

The campaign clearly increased traffic, so it is a load contributor. It does not by itself explain the recovery: traffic remained about 2,280–2,250 requests/min at 10:05–10:10 while recommendation-query work was back to 0.2 and latency recovered. The incident required the interaction between high traffic and the rollout's added database work.

## Safest first action

If the incident is still active, set `recommendations_checkout` to 0% immediately; if the existing mitigation at 10% is holding and disabling it has unacceptable product impact, keep 10% while confirming the same signals. Verify after the change:

- database pool utilization trends down and stays below the saturation region;
- checkout p95 falls below 800 ms, then returns toward the 315–340 ms baseline;
- retry rate falls toward the 1–2% baseline;
- request volume is not being misread as recovery because it dropped.

This action is narrow, reversible, and directly tests the leading hypothesis. Avoid increasing the database pool as the first action: that may delay symptoms while hiding the per-checkout query regression and could move pressure to the database itself. Avoid tuning retries first: it may reduce amplification but leaves the added database work in place.

## What remains unproven

The supplied files do not include database query latency, checkout error rate, pool wait time, host saturation, or a control-group comparison between feature-enabled and disabled requests. Therefore the diagnosis establishes a high-confidence operational cause and mitigation, but not the exact database query's execution plan or whether the database itself, the pool size, or query contention is the ultimate capacity boundary. Those should be investigated after stabilization.

## Reasoning record

Lens: Systems / interconnected mapping

Chose it because: traffic, feature rollout, database-pool saturation, and retries interact; there is no defensible single-factor chain.

Candidates: recommendation rollout plus traffic surge; retry policy; API v184; campaign traffic alone.

Distinguishing evidence: rollout timing and rollback, recommendation queries per checkout, request volume, pool utilization, retry rate, and p95 behavior before and after the rollback.

Ruled out: API v184 as the primary cause because p95 remained 310 ms after deployment, its documented change is a response-field rename with an alias, and no supplied metric links it to database load.

Ruled out: campaign traffic alone as a sufficient cause because traffic stayed near 2,250–2,280 requests/min during recovery while query work, pool utilization, retries, and p95 fell.

Ruled out: retry policy as the initiating cause because p95 crossed the 800 ms retry threshold before the 19% retry observation; retries are instead a load amplifier.

Defensibility: the leading claim is that excess recommendation queries under high traffic saturated the database pool and retries amplified it. It would be wrong if an independent change at the same time produced the same pool and latency pattern, or if feature-disabled requests showed the same degradation; the supplied evidence does not include those controls, so the claim is high confidence but not absolute.
