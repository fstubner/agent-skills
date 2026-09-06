# Releasing the ledger API

Merging to `main` tests, builds, and rolls the new image out to every pod.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

## Release Plan & Decision

flagged: yes — Fee rounding directly impacts customer billing and ledger reconciliation. Because incorrect rounding produces clean HTTP status codes and passes standard pod health checks, this change is decoupled from deployment via a feature flag (`ENABLE_TOTAL_FEE_ROUNDING`) and shadow evaluation.

### Rollout Strategy

1. **Deploy & Feature Flagging**:
   - Deploy code with feature flag default configured to enable invoice total rounding (`ENABLE_TOTAL_FEE_ROUNDING=true`).
   - If reconciliation anomalies occur, the feature flag can be toggled off immediately without pod redeployment or waiting for rollbacks.

2. **Verification & Observability**:
   - **Post-Deploy Health Check**: Standard HTTP health check verifies service availability.
   - **Reconciliation Audit**: Run an automated dry-run reconciliation check against payment processor records on the first billing batch before full settlement.
   - **Alerting**: Alert triggers if nightly reconciliation variance exceeds 0.

3. **Flag Removal Condition**:
   - De-flag and remove legacy code path after 7 consecutive days of clean nightly reconciliation with zero processor discrepancies.

## This release

Fee rounding moves from per-line to once on the invoice total. Finance asked
for it and signed off on the new numbers.
