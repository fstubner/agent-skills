# Fee Rounding v2 Deployment Decision

**Date**: 2026-09-01  
**Change**: Fee calculation rounding method  
**Risk Level**: High (silent financial reconciliation drift)  
**Approval**: Finance team (signed off on new numbers)

## Summary

This release changes fee rounding from **per-line** (v1) to **once-on-invoice-total** (v2). The finance team requested this change and has validated the impact on billing. However, wrong fees do not cause system crashes—they cause silent reconciliation failures discovered nightly or the next morning.

## The Problem We're Solving

- **v1 (legacy)**: Round each line's fee, then sum. Loses precision across split-penny lines.
- **v2 (new)**: Sum all line totals first, then round once. More accurate and matches finance's expectations.

**Example divergence**:
```
Lines: [111, 111, 111] (total 333)
Rate: 1% (100 basis points)

v1: (111 × 100 / 10,000 rounded) + (111 × 100 / 10,000 rounded) + (111 × 100 / 10,000 rounded)
  = 1.11 → 1 + 1.11 → 1 + 1.11 → 1 = 3 minor units

v2: (333 × 100 / 10,000) = 3.33 → 3 minor units
```

Both converge here, but real invoices with many varied lines accumulate rounding differences.

## Deployment Strategy

### Phase 1: Code Merge & Early Testing (NOW)
- [x] Implement v2 as default, keep v1 available for rollback
- [x] Add comprehensive test coverage for both modes
- [x] All tests pass locally
- [ ] Code review against edge cases (outstanding)

### Phase 2: Canary (Production - 5% of pods)
- Deploy to 1-2 pods in production with v2 enabled (default behavior)
- Monitor for 4-6 hours:
  - Do invoices generate? (health check)
  - Are fees calculated at all? (no null/zero edge case)
  - Finance team spot-checks a few invoices manually
- **Rollback trigger**: Any invoice generation failures, or finance spots a calculation error

**Rollback command**:
```bash
kubectl --context production set env deployment/ledger-api FEE_ROUNDING_VERSION=v1
# No pod restart required if env-var is read per-invocation
# Otherwise:
kubectl --context production rollout restart deployment/ledger-api
```

### Phase 3: Gradual Rollout (24-48 hours post-canary)
- Ramp to 25%, then 50%, then 100% of pods
- Continue monitoring invoice generation and fee distribution
- Finance team does cursory reconciliation spot-checks at each step

### Phase 4: Post-Deploy Verification
- After full rollout completes, run nightly reconciliation (happens automatically)
- Finance team reviews reconciliation report the next morning
- If any discrepancies, immediate rollback to v1 (see below)

## Rollback Plan

**If reconciliation disagrees with payment processor the next morning:**

```bash
# Option 1: Rollback via kubectl (fast, ~30 seconds)
kubectl --context production rollout undo deployment/ledger-api

# Option 2: Set environment variable to use v1 (if supported)
kubectl --context production set env deployment/ledger-api FEE_ROUNDING_VERSION=v1
kubectl --context production rollout restart deployment/ledger-api
```

**Important caveat**: Rollback restores the v1 code but does NOT fix invoices already issued with v2 fees. Finance team will need to:
1. Identify affected invoices (time window)
2. Issue adjusting credits/debits to reconcile with payment processor
3. Investigate which rounding was actually correct and why the change was requested

This is why validation before full rollout is critical.

## Validation Checklist

- [ ] All unit tests pass (both v1 and v2 modes)
- [ ] Code review: fee calculation logic for off-by-one errors
- [ ] Canary phase: 4-6 hours with 1-2 pods on v2
  - [ ] Finance manually verifies 5-10 invoices match expected fees
  - [ ] No invoice generation failures
- [ ] Gradual rollout: 25% → 50% → 100%
  - [ ] Health checks stay green throughout
  - [ ] Spot-check invoices at each stage
- [ ] Post-deploy: nightly reconciliation passes
  - [ ] Finance reviews reconciliation report
  - [ ] No unexpected discrepancies

## How to Enable Config

Currently hardcoded to v2 by default. To support runtime switching:

```javascript
const version = process.env.FEE_ROUNDING_VERSION || 'v2';
const fee = feeMinor(lineTotals, rate, version);
```

This allows rollback without redeployment (if pod restart is acceptable).

## Known Unknowns

- [ ] **What range of invoices actually see rounding differences?** Finance team should estimate impact before rollout (e.g., "affects ~2% of invoices").
- [ ] **Are there downstream systems (reconciliation, UI, reporting) that cached the old fees?** Reconciliation will detect it, but reporting UIs might show stale numbers until refreshed.
- [ ] **Does the payment processor's rounding match v1 or v2?** Critical to verify before rollout.

Finance team must provide answers to these before proceeding past canary.

## Decision Rationale

We are proceeding because:
1. Finance team explicitly requested this change (not a surprise)
2. Finance team has reviewed the new numbers and approved them
3. We have a rollback path that can be executed in <1 minute
4. We are validating in canary before full rollout, reducing blast radius
5. We are monitoring for silent failures (reconciliation) rather than assuming success

We would NOT proceed if:
- Finance team had NOT validated the new numbers
- We did not have a clear rollback mechanism
- We couldn't canary in production safely
