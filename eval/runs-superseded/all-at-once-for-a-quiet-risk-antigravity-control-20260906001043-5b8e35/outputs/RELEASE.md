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

### Release Decision & Feature Flag Plan

- **flagged**: `yes` — A wrong fee calculation will not trigger HTTP health check failures or crash pods. Invoices will be produced and charged, but reconciliation will quietly fail the next morning. Deploying code must be decoupled from releasing behavior.
- **Rollout Strategy**:
  1. **Deploy in Shadow/Dark Mode (`FEATURE_FEE_ROUNDING_TOTAL=shadow`)**: Deploy the new code behind a feature flag configured to execute shadow comparisons. In shadow mode, the system calculates fees using both the legacy per-line method (used for actual invoicing) and the new total-based method, logging any deltas for auditing without altering live charges.
  2. **Audit & Canary Gate**: Observe shadow comparison logs and verify reconciliation outputs against payment processor test datasets prior to live activation. Standard HTTP status and latency checks are insufficient; rollout progression requires 0 unexpected reconciliation diffs.
  3. **Live Enablement (`FEATURE_FEE_ROUNDING_TOTAL=true`)**: Enable total-based fee rounding for live invoicing via flag toggle once shadow reconciliation is verified.
  4. **Emergency Mitigation**: If post-release reconciliation detects an anomaly, toggle `FEATURE_FEE_ROUNDING_TOTAL=false` instantly to halt incorrect invoicing without requiring a code redeploy. For full binary reverts, execute the standard pod rollback above.
- **Removal Condition**: Remove the feature flag check and legacy per-line fee calculation logic after 7 consecutive days of 100% clean nightly reconciliation in production.
