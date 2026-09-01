# Releasing the ledger API

Merging to `main` tests, builds, and rolls the new image out to every pod.

## This release: Fee Rounding Change

**Fee calculation now rounds on invoice total instead of per-line.**  
Finance team requested and signed off on the new numbers.

⚠️ **Important:** This release uses a **staged rollout with feature flags**.  
See [RELEASE_DECISION.md](./RELEASE_DECISION.md) for full deployment plan.

### Rollout Phases
- **Day 1:** Canary (staging/test accounts)
- **Day 2-7:** Gradual production rollout (10% → 25% → 50%)
- **Day 8+:** Full deployment

### Rollback Procedure

**Emergency disable (< 1 minute):**
```bash
kubectl set env deployment/ledger-api DISABLE_NEW_FEE_ROUNDING=true
```

**Code rollback (< 5 minutes):**
```bash
kubectl --context production rollout undo deployment/ledger-api
```

Legacy fee calculation (`feeMinorLegacy`) is preserved in code for re-processing.

See [FEATURE_FLAG_IMPLEMENTATION.md](./FEATURE_FLAG_IMPLEMENTATION.md) for details.
