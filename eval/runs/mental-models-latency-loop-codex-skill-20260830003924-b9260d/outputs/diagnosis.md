# Latency incident diagnosis

## Conclusion

The primary trigger was increasing `recommendations_checkout` from 10% to
60% at 09:45 while campaign traffic was already rising. Each enabled
recommendation adds one database query per checkout. This increased database
work from 0.2 queries/checkout at 09:40 to 1.2 at 09:46, while request rate
rose from 1,000 to 2,300 requests/minute. The database pool then reached 96%
at 09:49 and 99% at 09:52; checkout p95 rose from 315 ms to 940 ms and then
1,480 ms.

A secondary feedback loop amplified the incident: the retry policy retries
twice when checkout exceeds 800 ms. Once p95 exceeded that threshold, retry
percentage increased from 8% at 09:49 to 19% at 09:52, adding demand to an
already saturated database and worsening latency.

The 09:15 v184 deployment is not supported as the initiating cause. At
09:28, after that deployment but before the rollout and campaign effects,
checkout p95 was still 310 ms. The listed v184 change is a response-field
rename with a compatibility alias retained; the evidence contains no error
or latency signal tied to it.

## Causal timeline

| Time | Observation | Interpretation |
|---|---|---|
| 09:15 | v184 deployed | A possible candidate, but not yet implicated. |
| 09:28 | p95 310 ms | No material regression visible after v184. |
| 09:44 | Campaign traffic begins | Request load increases. |
| 09:45 | Recommendations rollout 10% -> 60% | Database work per checkout increases. |
| 09:46 | 2,300 req/min, 1.2 recommendation queries/checkout, pool 78%, p95 420 ms | Load and query amplification appear together. |
| 09:49 | Pool 96%, p95 940 ms | Database saturation and threshold-crossing latency. |
| 09:52 | Pool 99%, retries 19%, p95 1,480 ms | Retry feedback adds further load. |
| 10:04 | Rollout restored to 10% | Direct mitigation applied. |
| 10:07 | Pool below 60% | Database pressure recedes after mitigation. |
| 10:10 | p95 340 ms | Latency recovers close to baseline while traffic remains high. |

The recovery is especially discriminating: at 10:05 recommendation queries
were back to 0.2/checkout and at 10:10 p95 was 340 ms, despite 2,250
requests/minute. That makes rollout-driven query amplification more likely
than traffic alone. The remaining elevated 10:05 latency and retry percentage
are consistent with the system draining saturation and the retry loop
unwinding.

## Safest first action

Immediately restore `recommendations_checkout` to its last known-good 10%
level (or disable it if the control cannot be changed safely), while
monitoring database-pool utilization, checkout p95, request rate, and retry
percentage. This is the safest first action because it is reversible, directly
removes the newly introduced query multiplier, and has already demonstrated
recovery in this incident: pool utilization fell below 60% and p95 returned
to 340 ms after the rollout was restored.

Do not increase capacity or re-enable the 60% rollout as the first response;
those actions do not remove the query amplification or retry feedback. Once
the system is stable, separately review the retry policy and add a guarded
rollout/load test for the per-checkout query cost. If retries can be safely
disabled or bounded without harming correctness, that is a useful secondary
containment step, but the evidence-backed first lever is the recommendation
rollout.

## Alternatives considered and limits

- **Campaign traffic alone:** It is a contributor, not a sufficient primary
  explanation. Traffic rose to roughly 2.3k requests/minute, but after the
  rollout returned to 10%, traffic remained about 2.25k/minute and p95
  recovered to 340 ms.
- **The v184 field rename:** The timing does not fit: p95 was 310 ms at 09:28,
  after deployment and before the incident. The retained compatibility alias
  also removes the obvious client-breakage mechanism. No error-rate or client
  compatibility evidence is present, so this is not proven impossible, only
  weakly supported.
- **Retries as the sole cause:** Retries clearly amplified the event, but retry
  percentage was only 3% at 09:46, before saturation, and rose after p95
  crossed 800 ms. That ordering makes retries a feedback factor rather than
  the initial trigger.
- **Database as an independent fault:** Pool saturation is real, but the
  change record identifies a new query per enabled checkout and the query
  count falls with the rollout. There is no evidence of a database failure
  independent of application demand.

The files do not provide per-endpoint error rates, database query latency,
capacity headroom, or exact retry request volume. Therefore the report can
establish the most likely causal chain and safe mitigation, but cannot
quantify the individual contribution of campaign traffic versus query
amplification or prove whether any database-side regression also existed.

## Reasoning record

Lens: Systems / interconnected mapping

Chose it because: multiple factors changed or interacted—traffic, feature
rollout, database work, and retries—and the symptom has a feedback loop rather
than one clean linear cause.

Candidates: recommendation query amplification; campaign traffic increase;
retry feedback loop; v184 response-field rename/client incompatibility;
independent database degradation.

Distinguishing evidence: timestamps around the 09:45 rollout, query counts,
request rate, pool utilization, retry percentage, p95 latency, and the
10:04–10:10 recovery after returning the rollout to 10%.

Ruled out: campaign traffic alone because traffic stayed near 2.25k/minute
after mitigation while p95 recovered; v184 rename because p95 was normal at
09:28 and a compatibility alias was retained; retries as the initiating cause
because retries rose after latency and pool saturation; an independent
database fault because pressure and latency tracked the recommendation query
count and rollout change.

Defensibility: the load-bearing claim is that the 10% -> 60% recommendation
rollout caused query amplification that saturated the database and initiated
the latency spike. It would be wrong if an unobserved simultaneous database,
network, or endpoint-specific failure independently caused the saturation and
the rollout/recovery correlation were coincidental; the available files do
not fully test those possibilities, so confidence is high for the primary
cause and lower for exact contribution percentages.
