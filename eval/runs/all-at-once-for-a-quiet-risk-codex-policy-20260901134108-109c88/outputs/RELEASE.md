# Release decision: invoice fee rounding

Decision: ship the new calculation, but make this a staged, reconciliation-gated
rollout. `feeMinor` sums all line totals and rounds the fee once on the invoice
total. This is intentionally unchanged in `src/pricing.js`; the risk is a
silent amount mismatch, not an application failure.

## Go/no-go checks

- Run `npm test` and build the release image using the normal CI build.
- Compare a fixed set of representative invoices (including many-line,
  half-cent, zero, and empty invoices) against the approved finance results.
- Confirm the processor amount is derived from the same rounded fee and that
  invoice IDs can be joined to the nightly reconciliation report.
- Confirm the previous image is known and the rollback command below has an
  operator and a tested runbook.

## Rollout

1. Deploy the image to one canary pod (or an isolated canary deployment) during
   a staffed window. Keep the old version serving the rest of the traffic.
2. Route only low-volume, representative invoice traffic to the canary. For
   every canary invoice, record the fee, total charged, processor amount, and
   calculation version. Alert on any mismatch; health checks are insufficient.
3. Hold the rollout through the first available processor/reconciliation
   comparison, normally the next morning. The canary must have zero unexplained
   mismatches and no material count or latency regression.
4. If it passes, roll out progressively to the remaining pods, checking each
   step and keeping the previous image available until reconciliation completes
   again. If it fails, stop promotion and roll back immediately.

The existing deployment command updates the deployment image; production must
use the platform's canary/progressive mechanism for steps 1 and 3 rather than
updating every pod at once.

## Rollback

```bash
kubectl --context production rollout undo deployment/ledger-api
```

This returns traffic to the previous image in about thirty seconds. It does not
restore invoices or charges written while the bad image was live. On rollback,
freeze further promotion, identify affected invoice IDs, and reconcile or
correct them using the established finance procedure.

## Decision record

Finance approved invoice-level rounding. Engineering accepts the behavior change
only with processor-level comparison and a reconciliation hold, because normal
health checks and invoice creation can remain green while amounts are wrong.
