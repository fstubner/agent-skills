# Releasing the ledger API

## Decision record: invoice fee rounding

**Decision:** ship the new calculation in `src/pricing.js`: sum all line totals
in minor units, then round the fee once on the invoice total. Keep the existing
`rollout undo` rollback procedure.

**Why:** Finance signed off on invoice-total rounding, and it matches the
payment processor's fee basis. This is a financial correctness change, not a
service-health change: invoices and charges can remain successful while the
amount is wrong.

**Scope and compatibility:** this release changes calculation only. It does
not rewrite historical invoices or attempt to reverse charges. The deployment
must therefore be observable and reversible at the image level, while
reconciliation remains the source of truth for correctness.

## Rollout plan

1. Before deploy, run the test and build checks, and have Finance approve a
   fixture set containing whole-cent, half-cent, multi-line, and empty-invoice
   cases. Record the expected fee from the processor-compatible calculation.
2. Deploy the image to one production pod using `scripts/deploy.sh` (or the
   equivalent controlled deployment mechanism). Confirm the pod is ready and
   serve a canary invoice fixture through that pod.
3. Compare canary fee outputs with the approved fixtures and processor test
   results. Do not use health checks, request success, or charge success as a
   fee correctness signal. Hold the rollout if any fee differs.
4. Expand in small batches, pausing after each batch for fee-output sampling
   and error monitoring. Keep the prior image available until the next
   reconciliation completes.
5. The next-morning reconciliation is the release gate. Confirm invoice fee
   totals agree with the payment processor for the release window before
   declaring the rollout complete.

## Abort and rollback

Abort immediately for a canary mismatch, unexplained fee variance, or any
reconciliation disagreement attributable to the release:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

The previous image should be serving again in about thirty seconds. Freeze
new rollout expansion, preserve the affected invoice/charge IDs, and have
Finance determine any correction or replay. Rollback changes code only; it
does not restore data written while the bad image was live.

## Release checks

Merging to `main` runs the automated tests and build before deployment. The
release owner must attach the canary comparison and next-morning
reconciliation result to the release record. Remaining uncertainty is the
processor's final settlement/reconciliation result; production health alone
cannot resolve it.
