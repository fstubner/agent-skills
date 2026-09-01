# Release Decision: Fee Rounding Change

**Date:** 2026-09-01  
**Change:** Invoice fee calculation rounding strategy  
**Status:** Ready for deployment with controlled rollout

## Summary

This release changes how platform fees are calculated on invoices. Fees transition from **per-line rounding** (legacy) to **invoice-total rounding** (new). This aligns with finance team requirements and reduces rounding discrepancies.

## What's Changing

### Before (Legacy)
- Each line item fee is calculated and rounded independently
- Line fees are summed
- **Example:** 3 lines × 0.5¢ base = 1.5¢ per line → rounds to 2¢ each → total 6¢

### After (New)
- All line totals are summed first
- Fee is calculated once on the total and rounded
- **Example:** 3 lines × 0.5¢ base = 1.5¢ total fee → rounds to 2¢

## Risk Assessment

**Severity:** Medium  
**Impact Zone:** Revenue reconciliation, customer invoicing  
**No Crash Risk:** Correct — invoices will generate regardless. Misalignment will surface in finance reconciliation against payment processor the next morning.

### Known Risks
- Rounding differences may cause line-by-line reconciliation issues
- Customer disputes if invoice totals don't match their expectations
- Batch processing may hide discrepancies for 24+ hours

## Deployment Strategy

### Phase 1: Canary (Day 1)
- Deploy to staging and run full invoice suite
- Generate 100 historical invoices with both algorithms
- Quantify rounding delta (% of invoices affected, $ variance)
- Finance team validates results match expectations
- **Rollback:** Trivial (revert code, re-run invoices)

### Phase 2: Gradual Rollout (Days 2-7)
- Deploy to production with feature flag enabled for 10% of accounts
- Monitor invoices for 48 hours
- Compare against payment processor reconciliation
- Check for customer complaints or support tickets
- Gradually increase to 25% → 50% → 100% if clean
- **Rollback:** Feature flag disables new code immediately

### Phase 3: Full Deployment (Day 8+)
- Remove feature flag, new behavior is standard
- Archive legacy calculation (no longer called)
- Monitor reconciliation for 1 week for anomalies

## Rollback Procedure

**If issues are detected:**

1. **Immediate (< 5 min):** Disable feature flag (if still in Phase 2)
   - All new invoices use legacy calculation
   - Existing invoices remain unchanged

2. **Short-term (< 1 hour):** Revert code deployment
   - `git revert <commit-hash>`
   - Redeploy production
   - Re-run overnight batch invoicing with legacy code

3. **Recovery:** Finance team reconciles using legacy calculations until root cause is found

## Code Safety

- Legacy calculation (`feeMinorLegacy`) is preserved in codebase
- Both functions are exported and testable
- No dependencies on new behavior in other modules
- Tests must verify both produce valid (though different) results

## Monitoring

**Daily (During Rollout)**
- [ ] Invoice generation success rate (target: 99.9%+)
- [ ] Average rounding difference per invoice (log for analysis)
- [ ] Payment processor reconciliation pass/fail
- [ ] Customer support tickets mentioning fees

**Weekly (Post-Deployment)**
- [ ] No regression in reconciliation
- [ ] Customer churn/complaint metrics unchanged

## Communication

- **Finance:** Notify 24 hours before canary with expected rounding deltas
- **Support:** Brief on the change; escalate any fee disputes to engineering
- **Customers:** No proactive notification (silent change if rounding goes up; they benefit if it goes down)

## Decision

**Approved for deployment** with staged rollout via feature flag.  
**Rollback capability:** Enabled (legacy code preserved).  
**Finance validation:** Required before Phase 2 expansion.

---

**Owner:** Release Lead  
**Reviewed by:** Finance, Product, Engineering  
