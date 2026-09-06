# Operations Runbook: Ledger API

## Signals
- **Health check endpoint**: `GET /health` returns HTTP 200 `{"status":"ok"}`.
- **Reconciliation discrepancy metrics**: Daily reconciliation logs comparing calculated fee totals vs payment processor totals. Emitted as structured JSON containing `invoiceId`, `computedFee`, `processorFee`, and `discrepancyMinor`.

## Alerts
- **Reconciliation Mismatch Threshold**: Alert triggers if daily reconciliation discrepancy total exceeds 0 minor units ($0.00).
- **First response**: Check whether the release changed fee rounding or calculation rules. Verify if fee rounding feature flag `FEE_ROUNDING_TOTAL_V2` was recently toggled or deployed.

## Failure modes
- **Silent Financial Discrepancy**: New fee rounding logic produces fee calculation variance compared to payment processor expectations. Service remains HTTP 200 healthy, but reconciliation reports mismatch next morning.
  - *Symptom*: Reconciliation audit fails at start of business; customer invoices reflect rounded total instead of per-line sum.

## Recovery
- **Feature Flag Disable**: Immediately disable feature flag `FEE_ROUNDING_TOTAL_V2` (or set `FEE_ROUNDING_MODE=per_line`) to revert fee calculation behavior to per-line rounding without redeploying binaries.
- **Image Rollback**: Documented rollback command:
  ```bash
  kubectl --context production rollout undo deployment/ledger-api
  ```
  Restores previous container image in ~30 seconds. Note: does not retroactively modify invoices already emitted.
