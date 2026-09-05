# Releasing the ledger API

Merging to `main` tests, builds, and rolls the new image out to every pod.

## Rollout decision & Feature Flag

- **flagged**: `yes` — Fee rounding changes introduce financial reconciliation risk that standard HTTP health checks cannot observe (invoices are produced normally and endpoints remain green). Decoupling deployment from release via a feature flag (`FEE_ROUNDING_TOTAL`) allows instant disabling of total-based rounding in seconds without redeploying code or rolling back images.
- **Removal condition**: Delete the feature flag branch and environment variable after 7 consecutive days of clean nightly payment processor reconciliation without discrepancy.

## Release & Health Observation Strategy

1. **Deploy**: Deploy container image containing the new total-level fee rounding logic behind feature flag `FEE_ROUNDING_TOTAL=true`.
2. **Observe**: Standard HTTP health check (`GET /healthz`) and post-deploy latency/error metrics verify container availability. However, because a bad fee calculation does not produce HTTP errors, actual release health observation relies on the first **nightly payment processor reconciliation run**.
3. **Action on Failure**: If nightly reconciliation detects a fee discrepancy between produced invoices and payment processor settlements, immediately execute feature flag disable (`FEE_ROUNDING_TOTAL=false`) or execute the rollback command below, and page on-call engineering.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

## This release

Fee rounding moves from per-line to once on the invoice total. Finance asked
for it and signed off on the new numbers.
