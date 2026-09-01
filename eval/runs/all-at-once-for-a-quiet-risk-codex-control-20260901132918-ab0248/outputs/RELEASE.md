# Releasing the ledger API

## Decision: staged rollout with a reconciliation gate

**Status:** approved for a controlled release; do not use the normal
merge-to-`main` all-pods rollout for this change.

Fee rounding is a financial correctness change. The new implementation rounds
once after summing the invoice lines, and it must remain in the release:

```js
Math.round((invoiceTotalMinor * rateBasisPoints) / 10_000)
```

The health check and post-deploy watch are not release gates for this risk:
they remain green when the amount is numerically wrong. The release owner must
therefore:

1. Deploy the image to one production canary (or the smallest isolated pod
   slice) and route only a bounded, representative set of invoices to it.
2. Before charging, record the fee from the new path and independently compute
   the expected fee by rounding the invoice total once. Compare both values
   and stop immediately on any mismatch.
3. Keep the canary live through the next processor reconciliation. Compare
   invoice totals, charged fees, and processor settlement data by invoice ID;
   aggregate totals alone are insufficient. Finance signs off on the result.
4. Roll out to the remaining pods only after the canary comparison is clean,
   the reconciliation is complete, and the release owner records the evidence
   and timestamp here or in the release log.

This intentionally makes the rollout wait for the first relevant
reconciliation. A green application health check is not sufficient approval.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

If the canary comparison or reconciliation disagrees, stop promotion and run
the rollback command above immediately.

After rollback, keep the affected invoice IDs and processor records for
Finance-led correction. Rollback prevents further incorrect charges; it does
not reverse or rewrite charges already made.

## Go / no-go checklist

- Go only when the canary uses the new invoice-total calculation, independent
  expected-value checks pass, and Finance has a named reviewer.
- No-go on any fee mismatch, missing invoice-to-processor mapping, unexplained
  duplicate charge, or reconciliation difference.
- The release owner records canary scope, image, check results, reconciliation
  window, reviewer, and promotion decision.

## This release

Fee rounding moves from per-line to once on the invoice total. Finance asked
for it and signed off on the new numbers.
