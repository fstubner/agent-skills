# Releasing the ledger API

Merging to `main` runs the gates below and produces one immutable image. That
same image is promoted through development, staging, and production; it is
never rebuilt between environments. Environment configuration and secrets are
injected at deploy time.

## Release decision

Fee rounding moves from per-line to once on the invoice total. The new fee
calculation in `src/pricing.js` is retained. `flagged: no — the calculation is
already selected by the released code path and introducing a runtime flag now
would create a second fee policy without a safe accounting migration.`

Because a wrong fee remains healthy at the HTTP level, this is a canary
release, not an all-at-once rollout:

1. Run lint (when configured), unit tests, and the smoke check; then build the
   image once and record its digest.
2. Promote that digest to development and staging. Run invoice examples that
   differ under per-line versus invoice-total rounding, then reconcile the
   expected fee totals against a captured processor fixture.
3. Deploy the digest to 1% of production traffic for 30 minutes. Compare fee
   totals and rounding-mode counters with the prior version and watch charge
   error rate, latency, and `/healthz`.
4. Halt the rollout and roll back immediately if any fee mismatch, unexplained
   rounding-mode change, charge error-rate regression, or health/latency SLO
   breach appears. If all remain clean, advance to 10%, 50%, then 100%, with
   a 30-minute observation window at each step.
5. Keep the previous image available until the next reconciliation completes.
   The release is complete only after the next-morning processor comparison
   agrees; otherwise use the rollback below and open an accounting incident.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

## This release

Finance asked for the invoice-total rounding and signed off on the new
numbers. The rollback remains the image rollback above; it does not restore
data written while the bad image was live, so already-issued invoices and
charges must be identified and reconciled separately.

## Pipeline gates

Cheap checks run before integration and deployment: repository smoke check,
unit tests, and lint if present; then integration/reconciliation fixtures;
then staging deployment and smoke checks. The production canary is gated on
observed health and fee correctness, and a bad reading halts the rollout and
invokes rollback.
