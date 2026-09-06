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

### Release Plan & Risk Mitigation

Because wrong fee calculations do not fail health checks or cause runtime errors, health probes remain green even if customer charges drift from payment processor expectations until next-morning reconciliation.

1. **Canary / Shadow Verification**
   - Deploy to canary pods first and run parallel reconciliation validation against Finance's expected outputs prior to full rollout.

2. **Immediate Post-Deploy Verification**
   - Trigger an immediate post-deploy reconciliation check on the first batch of generated invoices instead of waiting for the next morning's scheduled batch run.

3. **Rollback Execution**
   - If reconciliation discrepancies are detected post-release, execute the existing rollback command immediately:
     `kubectl --context production rollout undo deployment/ledger-api`

