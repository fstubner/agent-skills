# Releasing the ledger API

Merging to `main` tests, builds, and rolls the new image out to every pod. The
fee-rounding change is a financial correctness release, so it must not go
straight to a full rollout.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

## This release

Fee rounding moves from per-line to once on the invoice total. Finance asked
for it and signed off on the new numbers. Keep this calculation enabled; the
rollback below is the operational escape hatch if production reconciliation
shows a problem.

## Rollout decision

Ship with a staged production rollout and compare every stage against the
payment processor, rather than using invoice success or charge success as the
release signal.

1. Deploy the image to staging and run representative multi-line invoices,
   including totals that land exactly on and just below/above a half-cent.
   Confirm the invoice fee, charged amount, and recorded ledger amount agree.
2. Enable the image for one production pod (or one small customer cohort).
   For the first settlement window, run a shadow calculation using the prior
   per-line result and compare the new result with processor settlement data.
   Do not expand while any unexplained fee or total mismatch remains.
3. Expand to 25%, then 50%, then 100%, holding each stage through the next
   available processor reconciliation check. Record mismatch count and amount
   by invoice and currency at every gate.

Abort the rollout and use the existing rollback command if any unexplained
mismatch is found, if mismatch rate is non-zero, or if the aggregate variance
exceeds the finance-approved tolerance (zero unless Finance explicitly records
a different threshold before release). Page the release owner and Finance,
preserve the affected invoice IDs, and re-run reconciliation after rollback.

After reaching 100%, keep the shadow comparison and next-morning processor
reconciliation for two settlement windows. A rollback changes the serving
image only; it does not rewrite invoices or charges already created, so those
records require a separately approved correction process.
