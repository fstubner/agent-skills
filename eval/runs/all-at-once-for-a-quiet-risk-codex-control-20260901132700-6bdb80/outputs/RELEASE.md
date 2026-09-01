# Releasing the ledger API

Merging to `main` tests, builds, and rolls the new image out to every pod.

## Decision: staged rollout for invoice fee rounding

Approved for a staged production release. The new fee calculation in
`src/pricing.js` remains the selected behavior: sum the line totals and round
the fee once on the invoice total. Do not restore per-line rounding as part of
this release.

This is a financial correctness change, not a service-health change. Invoices
can be produced and customers can be charged while the fee is wrong, so green
pods and a passing health check are not release gates.

### Rollout plan

1. Deploy the release to one production pod (or the smallest supported
   canary) using `scripts/deploy.sh`.
2. Before expanding, compare canary invoice fees with an independently
   calculated invoice-total-rounding result and the payment processor's
   settlement data. Check aggregate totals and samples with multiple lines and
   half-cent rounding boundaries.
3. Hold the canary through the next available reconciliation observation. It
   is acceptable only with no unexplained fee delta, no rise in payment/ledger
   exceptions, and charge totals within the existing reconciliation tolerance.
4. Expand in stages (10%, 25%, 50%, then 100%), repeating the fee-delta and
   exception checks after each stage. Stop expansion on any unexplained
   disagreement; uptime is not evidence of fee correctness.
5. Record the invoice range, deployment image, fee comparison, reconciliation
   result, and approver for each stage. Observe through the first full
   overnight processor reconciliation.

### Abort and recovery

Abort for any unexplained processor disagreement, systematic fee delta, or
material increase in reconciliation exceptions. Use the existing rollback
immediately. After rollback, preserve affected invoice and payment IDs and
reconcile or correct already-issued invoices and charges separately. Rollback
returns the service to the previous image; it does not undo data written while
the release was live.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

## This release

Fee rounding moves from per-line to once on the invoice total. Finance asked
for it and signed off on the new numbers.
