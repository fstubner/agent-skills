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

### Important: Controlled Deployment Required

**This release uses a feature flag for gradual rollout. Do not use standard all-at-once deployment.**

See **DEPLOYMENT_PLAN.md** for the complete strategy, which includes:
- Staged rollout (10% → 50% → 100% over 3 hours)
- Finance team validation checkpoints at each stage
- Environment variable control: `ENABLE_NEW_FEE_ROUNDING_PERCENT=0-100`
- Quick rollback via environment variable change

Both old and new fee calculations remain in the codebase (`feeMinor_old` and `feeMinor_new`) to support rollback without code changes. The dispatcher function `feeMinor()` selects the implementation based on the feature flag.

### Deployment Timeline
1. Notify Finance team 2 hours before
2. Deploy with flag disabled (old logic active)
3. Stage through 10% → 50% → 100% with 1-hour intervals
4. Finance audits samples at 10% and 50% stages
5. Enable 100% after approval
6. Next morning: Finance runs reconciliation verification

Rollback command for quick revert:
```bash
kubectl --context production set env deployment/ledger-api ENABLE_NEW_FEE_ROUNDING_PERCENT=0
```
