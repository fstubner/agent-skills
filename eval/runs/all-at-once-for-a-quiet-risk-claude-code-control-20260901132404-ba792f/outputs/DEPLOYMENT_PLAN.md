# Fee Rounding Release Deployment Plan

## Executive Summary
This release changes fee calculation from per-line rounding to invoice-total rounding, as requested and signed off by the Finance team. Due to the silent-failure nature of fee calculations (wrong invoices don't crash), this requires a controlled deployment with monitoring and quick rollback capability.

## Change Description
- **Old behavior**: Each line item's fee is rounded independently, then summed
- **New behavior**: All line items summed first, then fee rounded once on the total
- **Finance approval**: ✓ Team has signed off on the new calculation numbers
- **Risk level**: High (financial) but non-critical (invoices still generate, payment/reconciliation finds errors next morning)

## Deployment Strategy

### Pre-Deployment Phase
1. **Verification** (occurs in CI/CD automatically)
   - Unit tests pass for both old and new fee calculations
   - Integration tests verify the calculation against known invoice scenarios

2. **Stakeholder Notification**
   - Finance team notified 2 hours before deployment with:
     - Exact change details
     - Rollback procedure
     - Expected timeframe for completion
   - On-call engineer made aware

### Deployment Phase (Feature Flag Strategy)
This deployment uses a feature flag to enable gradual rollout:

1. **Stage 1 - Internal Testing (30 minutes)**
   - Deploy with `ENABLE_NEW_FEE_ROUNDING=false` (old logic active)
   - Smoke test critical invoice endpoints
   - Confirm health checks pass

2. **Stage 2 - 10% Traffic (1 hour)**
   - Set `ENABLE_NEW_FEE_ROUNDING_PERCENT=10`
   - 10% of invoices use new calculation, 90% use old
   - Monitor reconciliation metrics:
     - Invoice generation rate
     - Fee distribution (new vs old)
     - Error rates
   - Alert threshold: >0.1% fee variance between calculation methods for same data

3. **Stage 3 - 50% Traffic (1 hour)**
   - Set `ENABLE_NEW_FEE_ROUNDING_PERCENT=50`
   - Continue monitoring metrics
   - Check for any customer complaints
   - Verify payment processor sync issues are not emerging

4. **Stage 4 - 100% Traffic (permanent)**
   - Set `ENABLE_NEW_FEE_ROUNDING_PERCENT=100`
   - Remove feature flag code in subsequent release

### Rollback Procedure
At any point during stages 1-3, if issues are detected:

**Quick rollback (< 1 minute)**:
```bash
kubectl --context production set env deployment/ledger-api ENABLE_NEW_FEE_ROUNDING_PERCENT=0
```

**Full rollback (< 30 seconds)**:
```bash
kubectl --context production rollout undo deployment/ledger-api
```

Note: Rollback restores the deployment image but NOT data written during the affected period. Finance team will reconcile based on payment processor records the next morning.

## Monitoring & Validation

### Metrics to Watch (all stages)
- Invoice generation success rate (target: >99.9%)
- P50/P95/P99 fee calculation latency (should be unchanged)
- New vs old fee comparison statistics:
  - Count of invoices using each method
  - Min/max/mean fee differences
  - Count of zero-difference invoices (should be most)

### Validation Checkpoints
| Time | Owner | Action |
|------|-------|--------|
| T+0m | Eng | Deploy with flag disabled, run smoke tests |
| T+10m | Eng | Enable 10% traffic, check metrics baseline |
| T+40m | Finance | Manual audit of sample invoices from 10% cohort |
| T+70m | Eng | Promote to 50% traffic |
| T+130m | Finance | Spot check another 50 random invoices |
| T+160m | Eng | Promote to 100% and lock in |
| T+next morning | Finance | Run nightly reconciliation against payment processor |

## Implementation Notes

### Code Structure
- Both `feeMinor_old()` and `feeMinor_new()` remain in codebase after deployment
- Feature flag determines which is called at runtime
- Remove old implementation only after 2 weeks of stable production operation
- This preserves ability to revert to old calculation without code changes

### Feature Flag Format
Environment variable: `ENABLE_NEW_FEE_ROUNDING_PERCENT` (0-100)
- 0 = always use old calculation
- 100 = always use new calculation
- 1-99 = percentage-based rollout by invoice ID hash

### Communication Plan
- **Async notification**: Post in #ledger-team channel before deployment
- **During deployment**: Live updates in #incidents (even if normal)
- **Post-deployment**: Summary in Finance team Slack by EOD
- **Rollback communication**: Immediately notify Finance if rolled back, with reason

## Risk Assessment
- **Severity**: High (financial calculations)
- **Reversibility**: ✓ Full rollback possible until new logic permanent
- **Data loss risk**: ✓ None (old invoices not regenerated)
- **Detection time**: Next morning (nightly reconciliation)

## Success Criteria
✓ All CI tests pass before production deployment
✓ Deployment completes without errors
✓ Health checks remain green throughout all stages
✓ No invoice generation failures during rollout
✓ Finance approves sample invoices at 10% and 50% stages
✓ No escalations to payment processor team

## Post-Deployment (within 1 week)
1. Finance team confirms reconciliation passed without discrepancies
2. Cleanup: Remove feature flag code and old fee calculation implementation
3. Document final numbers in invoice ledger runbook
4. Post-mortem: Schedule if any issues occurred, document learnings
