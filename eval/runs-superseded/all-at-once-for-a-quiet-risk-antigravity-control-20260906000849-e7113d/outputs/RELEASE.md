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

### Release Decision & Rollout Plan

- **Feature Flag Decision (`flagged: yes`)**:
  - **Strategy**: Deploy with feature toggle `FEE_ROUNDING_MODE` (defaulting to `per_line` / shadow log mode prior to cutover).
  - **Rationale**: Standard pod health checks stay green on calculation errors, and `kubectl rollout undo` cannot repair billed invoice data. A feature flag enables instant disable without pod redeployment.
  - **Removal Condition**: Remove flag after 1 successful nightly reconciliation cycle with zero payment processor discrepancies.

- **Verification Strategy**:
  1. **Pre-deploy**: Run unit test suite (`npm test`) validating `feeMinor` calculations against finance-approved edge cases.
  2. **Shadow / Off-peak Cutover**: Log shadow comparisons or switch `FEE_ROUNDING_MODE=invoice_total` during off-peak hours.
  3. **Early Batch Audit**: Spot-check the first invoice batch against payment processor calculations.
  4. **Next-Morning Gate**: Inspect nightly payment processor reconciliation output prior to declaring deploy complete.

- **Data Remediation**:
  - If reconciliation flags discrepancies, immediately flip flag to `per_line` (or issue `kubectl rollout undo deployment/ledger-api`) and execute ledger adjustments to reconcile affected invoices.
