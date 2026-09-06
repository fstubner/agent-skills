# Releasing the ledger API

Merging to `main` tests, builds, and rolls the new image out to every pod.

## Pipeline & Deployment Strategy

- **Artifact Promotion**: Build once, test in staging, promote identical image to production.
- **Environment Config**: Database URLs, API keys, and runtime parameters injected at deploy time via environment variables.
- **Deployment Strategy**: Canary rollout starting at 5% pod traffic to monitor reconciliation signals before 100% rollout.

## Decoupled Release & Feature Flags

- **Flagged**: yes — `FEE_ROUNDING_TOTAL_V2` (Environment variable `FEE_ROUNDING_MODE=invoice_total|per_line`)
- **Reason**: Silent financial discrepancy risk (reconciliation mismatches next morning). Decoupling deployment from release allows instant kill-switch behavior without redeploying code.
- **Removal Condition**: Flag permanently enabled and removed 14 days post-release after 100% clean reconciliation reports.

## Health Observation & Gating

- **Health Check Gate**: `GET /health` polled during deployment.
- **Observation Window**: 30-minute health and error-rate monitoring window post-canary.
- **Automated Trigger**: Automated rollback if HTTP 5xx error rate > 0.1% or health check fails.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

Alternatively, disable the feature flag to revert calculation instantly:
```bash
kubectl --context production set env deployment/ledger-api FEE_ROUNDING_MODE=per_line
```

## This release

Fee rounding moves from per-line to once on the invoice total. Finance asked
for it and signed off on the new numbers.
