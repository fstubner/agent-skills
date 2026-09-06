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

### Risk & Silent Failure Mitigation Plan

Because fee calculation errors will not fail health checks or trigger standard deployment alerts, the rollout plan requires active verification:

1. **Pre-Deploy Verification**:
   - Run automated unit tests (`node --test test/pricing.test.js`) verifying `feeMinor` calculations against expected totals.
2. **Canary / Staging Validation**:
   - Deploy first to staging/canary environment using `./scripts/deploy.sh staging <image>`.
   - Run shadow calculations or process test invoices comparing expected invoice-level rounded fees against payment processor ledger mocks prior to full production promotion.
3. **Production Rollout & Reconciliation**:
   - Execute `./scripts/deploy.sh production <image>`.
   - Perform post-deploy sample invoice spot-checks immediately after rollout.
   - Audit first overnight payment processor reconciliation report prior to next morning batch settlement.
4. **Rollback Action**:
   - If reconciliation discrepancies exceed allowed variances, immediately execute `kubectl --context production rollout undo deployment/ledger-api`.

