# Releasing the ledger API

## Decision: release the invoice-total fee rounding change

Decision: keep the new calculation in `src/pricing.js`—sum line totals and
round the fee once—and release it behind a controlled rollout. The existing
rollback remains the authoritative recovery path.

### Rollout plan

1. Run the test suite and build the image from the same commit. Review the
   focused fee cases, including a boundary where per-line and invoice-total
   rounding differ.
2. Deploy to one production pod using `scripts/deploy.sh`, then verify invoice
   totals, charged amounts, logs, and a sample of persisted invoices. Health
   checks are insufficient evidence for this change.
3. Compare calculated fees with the payment processor's fee data for the
   canary's invoices. Do not expand while any unexplained mismatch exists.
4. Expand gradually to the remaining pods. Keep the old image available and
   monitor fee deltas and reconciliation results through the next morning's
   processor reconciliation. Record the commit, image, sample size, and
   mismatches.

### Stop and rollback criteria

Stop the rollout and roll back immediately for any unexplained fee mismatch,
wrong rounding boundary, duplicate or missing charge, or material increase in
reconciliation exceptions. A green health check or successful invoice
creation does not override these criteria.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

## This release

Fee rounding moves from per-line to once on the invoice total. Finance asked
for it and signed off on the new numbers. This decision keeps that calculation
and requires reconciliation evidence before full rollout.
