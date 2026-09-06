# Releasing the ledger API

Merging to `main` tests, builds, and rolls the new image out to every pod.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

## This release

Fee rounding moves from per-line to once on the invoice total. Finance asked
for it and signed off on the new numbers.

## Release & Verification Decision

Because a fee calculation discrepancy will not crash services or trigger health check alerts, deployment must be paired with explicit early verification:

1. **Pre-Deploy Verification**: Run focused unit tests on total fee rounding (`node --test test/pricing.test.js`).
2. **Early Reconciliation Audit**: Do not wait for the next morning's automated reconciliation run. Immediately after rollout, compare the fee output of the first post-deploy invoice batch against payment processor calculations.
3. **Rollback Condition**: If reconciliation mismatches occur on early invoice batches, execute `kubectl --context production rollout undo deployment/ledger-api` immediately to minimize affected invoices.

