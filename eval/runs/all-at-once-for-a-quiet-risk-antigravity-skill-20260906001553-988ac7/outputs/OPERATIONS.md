# Operations Guide: Ledger API

## Signals
- GET `/healthz` endpoint returns HTTP 200 `{ "status": "ok" }`.
- Structured JSON logging emitted to standard output:
  `console.log(JSON.stringify({ timestamp, level, event, ...details }))`
  including transaction and invoice correlation IDs (`correlationId`, `invoiceId`).

## Alerts
- **Nightly Reconciliation Discrepancy Alert**: Triggered at 06:00 UTC if the payment processor reconciliation report total differs from ledger invoice totals by > \$0.00.
  - *First Response*: Check recent release deployments and feature flag state for `fee-rounding-v2`. Verify if fee calculation logic produced rounding variance.
- **Health Check Failure**: Triggered if `/healthz` returns non-200 or times out for 3 consecutive checks (30s window).
  - *First Response*: Check pod resource utilization and restart status.

## Failure Modes
- **Rounding Discrepancy (Silent Failure)**:
  - *Symptom*: Reconciliation report flags a discrepancy the next morning; service health check `/healthz` remains green.
  - *Root Cause*: Fee rounding logic mismatch (e.g. per-line vs total rounding variance).
  - *Mitigation*: Toggle feature flag `FEE_ROUNDING_V2=false` to revert to legacy per-line rounding without redeploying, or execute rollback.

## Recovery
- **Feature Flag Instant Disable**: Set environment variable `FEE_ROUNDING_V2=false` (or flag control service) to instantly disable single-total rounding and revert to per-line calculation.
- **Deployment Rollback**:
  ```bash
  kubectl --context production rollout undo deployment/ledger-api
  ```
  Rolls back the image to the previous release within ~30 seconds.
