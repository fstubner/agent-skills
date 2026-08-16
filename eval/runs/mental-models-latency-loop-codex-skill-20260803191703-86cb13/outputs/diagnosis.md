# Latency incident diagnosis

## Conclusion

The incident was caused primarily by the interaction of three factors:

1. **Recommendation rollout expansion:** `recommendations_checkout` moved from 10% to 60% at 09:45. The change notes say each enabled checkout adds one database query. The metrics show recommendation queries per checkout rising from 0.2 at 09:40 to 1.2 at 09:46 and thereafter.
2. **Traffic increase:** campaign traffic began at 09:44. Requests per minute rose from 1,000 at 09:40 to about 2,300 by 09:46, a 2.3x increase. This increased the absolute database work at the same time as the per-request work increased.
3. **Retry amplification:** the checkout retry policy retries twice when checkout exceeds 800 ms. As the database saturated, p95 crossed 800 ms, and retries rose from 1% at 09:40 to 19% at 09:52. Retries therefore fed additional load into an already saturated pool.

The recommendation rollout is the most actionable initiating factor supported by the data. The traffic campaign was a load multiplier, and retries were a feedback amplifier. The API v184 response-field rename is not supported as the primary cause: it retained a compatibility alias, checkout p95 was already about 310 ms at 09:28 after the 09:15 deploy, and the incident tracks the later rollout/traffic change instead.

## Evidence trail

| Time | Observed evidence | Interpretation |
|---|---|---|
| 09:15 / 09:28 | v184 deployed; checkout p95 remains 310 ms | No immediate latency jump after v184. |
| 09:44–09:45 | Campaign traffic begins; recommendation rollout changes 10% → 60% | Two load-changing events precede the degradation. |
| 09:40 → 09:46 | Requests/min 1,000 → 2,300; recommendation queries/checkout 0.2 → 1.2; DB pool 41% → 78%; p95 315 → 420 ms | Demand and database work increase together before saturation. |
| 09:47–09:52 | Timeline reports p95 >900 ms, then pool >95%; metrics show pool 96% → 99%, p95 940 → 1,480 ms, retries 8% → 19% | Saturation and retry feedback coincide with the worst latency. |
| 10:04–10:10 | Rollout restored to 10%; pool falls below 60%; p95 returns to 340 ms | Reversible rollback is followed by recovery while traffic remains about 2,250–2,280 rpm. This is the strongest intervention evidence. |
| 10:05 | Recommendation queries/checkout 0.2; pool 71%; p95 780 ms; retries 12% | Rollback reduces the main added work, but retries and backlog take time to drain. |
| 10:10 | Pool 55%; retries 2%; p95 340 ms | System returns close to baseline after the feedback loop clears. |

The timing and the controlled change are more informative than correlation alone: the high traffic remains after the rollback, while recommendation query volume drops and the latency indicators recover.

## Causal model

Campaign traffic increased request volume. At the same time, enabling recommendations for more checkouts increased database queries per checkout. The resulting database pool saturation slowed checkout beyond the 800 ms retry threshold. Retries then generated more checkout attempts, increasing database demand and worsening latency. Restoring the rollout reduced the extra query work; the pool and retry rate then drained, and p95 recovered.

This explains all of the reported signals: the latency increase, database saturation, retry increase, and recovery after rollback.

## Safest first action

Keep `recommendations_checkout` at the known-safe 10% setting (or, if the incident is actively worsening and the control supports it, temporarily set it to 0%) and do not re-expand it while observing checkout p95, DB pool utilization, and retry rate. This is the safest first action because it is reversible, directly removes the load whose rollback was followed by recovery, and preserves most of the service rather than making an unverified database or application change.

If the incident is still active, confirm the setting is at 10% immediately, then watch for pool utilization to remain below saturation and retries to fall. Avoid increasing retry limits; that would amplify the suspected feedback loop. Once stable, separately load-test or profile the recommendation query path before another rollout, and review whether the retry threshold/attempt count needs a bounded circuit-breaker or backoff.

## Alternatives considered and limitations

- **v184 API rename:** Possible in principle, but the compatibility alias was retained, p95 was still 310 ms at 09:28, and the later rollback of recommendations—not a v184 rollback—preceded recovery. It is not the best-supported explanation.
- **Campaign traffic alone:** It clearly contributed demand, but traffic stayed near 2,250–2,280 rpm after the recommendation rollback while p95 recovered from 780 ms to 340 ms. Traffic alone does not explain the recovery.
- **Retry policy alone:** Retries amplified the outage, but retry percentage was only 1% at baseline and rose after latency crossed the retry threshold. It is a feedback factor, not the initiating cause demonstrated by these files.
- **Database capacity or an independent database fault:** Pool saturation is observed, but the files contain no database error rates, query timings, or capacity change. The rapid recovery after reducing recommendation queries makes an independent fault less likely, not impossible. Validate with database query latency/errors and per-query load before treating this as proven.

The data does not establish an exact per-query database cost, whether the campaign and rollout were independently scheduled, or whether retries are counted per client request or per attempt. Those gaps affect capacity sizing, but not the immediate rollback recommendation.

## Reasoning record

Lens: Systems / interconnected mapping

Chose it because: the incident has several plausible contributors—traffic, a feature rollout, retry behavior, and a recent API deploy—and the observed signals form a feedback loop rather than one clean linear chain.

Candidates: recommendation rollout increasing database work; campaign traffic increasing demand; retry policy amplifying slow requests; v184 response-field rename; independent database capacity/fault.

Distinguishing evidence: compare event timing, recommendation queries per checkout, request volume, pool utilization, retries, and p95 before and after the rollout rollback. Found: recommendation queries fell from 1.2 to 0.2, pool utilization fell from 99% to 55%, retries from 19% to 2%, and p95 from 1,480 ms to 340 ms while traffic remained high.

Ruled out: v184 as the primary cause because p95 remained 310 ms after its deploy and before the incident window, and the response alias was retained. Ruled out: traffic alone because traffic remained around 2,250 rpm during recovery. Ruled out: retries as the initiating cause because retries increased after p95 crossed 800 ms and then fell after the feature rollback. An independent database fault is not ruled out completely; it is downgraded because the rollback produced the expected multi-signal recovery.

Defensibility: the load-bearing claim is that the 60% recommendation rollout, under campaign traffic, saturated the database and triggered retry amplification. This would be wrong if the apparent recovery were caused by another unrecorded change at 10:04–10:10, or if recommendation query volume did not materially consume the saturated pool; the supplied files show no concurrent change, but query timings/errors and a change audit would be needed to check those possibilities.
