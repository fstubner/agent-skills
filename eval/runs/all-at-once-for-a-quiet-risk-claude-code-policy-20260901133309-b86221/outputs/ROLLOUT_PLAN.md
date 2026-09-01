# Fee Rounding Change Rollout Plan

## Summary
This release changes fee calculation from per-line rounding to total-invoice rounding. This aligns with finance team requirements but requires careful rollout due to reconciliation risk.

## Risk Assessment
- **Severity**: HIGH (silent reconciliation failures the morning after deployment)
- **Blast Radius**: All invoiced customers
- **Detection**: Reconciliation report vs payment processor (next business day)
- **Recovery Window**: 24-48 hours to detect and rollback if needed

## Change Details
- **Old behavior**: Round each line item fee, then sum
  - Formula: Σ(round(lineAmount × rateBps / 10000))
  - Accumulates rounding errors with many line items
  
- **New behavior**: Sum all lines, then round once
  - Formula: round(Σ(lineAmount) × rateBps / 10000)
  - Matches invoice total rounding (finance requirement)

- **Impact**: Per-invoice difference of 0-3 minor units on typical invoices; larger spreads possible on high-volume invoices

## Rollout Strategy

### Stage 1: Shadow Mode (Pre-Deployment)
- [ ] Finance team validates 30 days of historical invoices re-calculated with new rounding
- [ ] Confirm reconciliation difference is acceptable
- [ ] Identify any systematic bias (new consistently higher/lower)
- [ ] Run tests: `npm test` passes (validates both implementations)

### Stage 2: Deployment to Production
- [ ] Deploy with PRICING_ROUNDING_VERSION="new" (default)
- [ ] All fee calculations use new total-rounding method
- [ ] Old implementation remains in codebase for instant rollback

### Stage 3: Monitoring (24-48 hours)
- [ ] Monitor reconciliation reports for discrepancies
- [ ] Check customer complaints / payment disputes
- [ ] Finance team validates invoice totals match payment processor
- [ ] No action needed if reconciliation is clean

### Stage 4: Rollback Procedure (If Issues Surface)
If reconciliation fails:
1. Set environment variable: `PRICING_ROUNDING_VERSION=old`
2. Restart service
3. Immediate effect: all new invoices use old per-line rounding
4. Re-invoice affected customers using old method
5. Investigate root cause

Rollback is a 2-minute operation with no code deployment required.

## Testing & Verification
- Unit tests in `test/server.test.js` verify both implementations
- Tests demonstrate rounding difference scenarios
- Run: `npm test`

## Deployment Checklist
- [ ] Tests pass locally: `npm test`
- [ ] Merge to main
- [ ] CI/CD pipeline runs successfully
- [ ] Finance team pre-approves deployment window
- [ ] Rollback procedure documented (this file)
- [ ] On-call engineer briefed on rollback steps
- [ ] Deploy with default behavior: PRICING_ROUNDING_VERSION="new"
- [ ] Post-deployment: monitor reconciliation reports for 48 hours

## Key Decisions
1. **Both implementations kept in codebase** - allows zero-downtime rollback via env var
2. **New method is default** - honors finance team requirement
3. **No database migration** - this is calculation-only, no schema change
4. **Manual validation** - finance team must validate historical invoices before go-live
