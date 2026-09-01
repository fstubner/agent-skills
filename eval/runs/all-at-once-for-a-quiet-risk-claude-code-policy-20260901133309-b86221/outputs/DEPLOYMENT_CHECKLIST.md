# Pre-Deployment Checklist: Fee Rounding Change

## Stage 1: Pre-Deployment Validation (48 hours before)

### Code Review
- [ ] Review `src/pricing.js` - verify both `feeMinorNewRounding()` and `feeMinorOldRounding()` are present
- [ ] Review `test/server.test.js` - verify all 7 tests are present and assertions are correct
- [ ] Verify `feeMinor()` routes correctly based on `PRICING_ROUNDING_VERSION` env var
- [ ] Confirm tests pass locally: `npm test`

### Finance Validation
- [ ] Finance team has validated 30+ days of historical invoices re-calculated with new rounding
- [ ] Finance has confirmed difference vs current method is acceptable (document any material bias)
- [ ] Accounting has approved rollout timeline
- [ ] Finance has sign-off on reconciliation monitoring plan

### Operations Readiness
- [ ] On-call engineer briefed on rollback procedure (see "Stage 4: Rollback" section)
- [ ] Runbook updated with PRICING_ROUNDING_VERSION environment variable usage
- [ ] Monitoring alerts configured for reconciliation report discrepancies
- [ ] War room scheduled for morning after deployment (async reconciliation review)

### CI/CD Readiness
- [ ] Verify `.github/workflows/deploy.yml` includes `npm test` step before production deploy
- [ ] Confirm GitHub environment protection rules for production branch are in place
- [ ] Verify Docker build process includes test run
- [ ] Test deploy workflow in staging environment if possible

## Stage 2: Deployment Day

### Pre-Deployment (30 min before)
- [ ] Confirm production environment is stable (no active incidents)
- [ ] Confirm payment processor is operating normally (check status page if available)
- [ ] Notify finance team: "Deployment starting in 5 minutes"
- [ ] Have rollback procedure accessible (see Stage 4 below)

### Deployment
- [ ] Push code to `main` branch (triggers CI/CD)
- [ ] Monitor CI/CD pipeline: tests must pass before production deploy
- [ ] Confirm deployment completed successfully via kubectl or deployment dashboard
- [ ] Verify service health: GET /entries/{id} endpoint responds normally

### Post-Deployment (Immediate)
- [ ] Confirm PRICING_ROUNDING_VERSION is unset (defaults to "new")
- [ ] Verify at least one invoice processed successfully
- [ ] Confirm no errors in application logs related to pricing
- [ ] Notify finance team: "Deployment complete, monitoring started"

## Stage 3: Monitoring (Next 48 Hours)

### 24 Hours Post-Deployment
- [ ] Review reconciliation report (normally runs overnight)
- [ ] Check for systematic difference: new method consistently higher/lower?
- [ ] Review payment disputes from customers (none expected)
- [ ] Check application error logs for pricing-related failures
- [ ] Finance team reviews invoice totals vs payment processor
- [ ] **No action needed if reconciliation is clean**

### 48 Hours Post-Deployment
- [ ] Second reconciliation report review (two data points to confirm trend)
- [ ] Finance declares success or escalates issues
- [ ] Document decision: proceed with new method or execute rollback
- [ ] Update runbook based on actual behavior observed

## Stage 4: Rollback Procedure (If Issues Surface)

**Time to completion: 2-5 minutes from decision**

### Steps
1. **Diagnose** (1 min)
   - Finance team has identified reconciliation mismatch
   - Issue is systematic (not one-off invoice) or affecting many customers

2. **Prepare** (30 sec)
   - SSH to production environment
   - Prepare rollback command

3. **Execute** (1 min)
   ```bash
   # Set environment variable to old rounding method
   export PRICING_ROUNDING_VERSION=old
   
   # Restart service (exact command depends on deployment model)
   systemctl restart ledger-api
   # OR for Kubernetes:
   kubectl set env deployment/ledger-api PRICING_ROUNDING_VERSION=old
   kubectl rollout status deployment/ledger-api --timeout=5m
   ```

4. **Verify** (1 min)
   - Confirm service is healthy: `curl http://ledger-api/entries/test`
   - Monitor logs for errors
   - New invoices now use old per-line rounding method

5. **Notify** (30 sec)
   - Alert finance team: rollback complete
   - Begin investigation of root cause

6. **Recover** (30 min - 2 hours)
   - Finance identifies affected customers
   - Re-invoice affected customers using old method
   - Create incident report

### What Rollback Does
- Immediately switches all new invoice calculations to old per-line rounding
- No code deploy, no database migration, no loss of data
- Existing invoices (already created) are unaffected
- Only future invoices use the old method

### What Rollback Does NOT Do
- Does not re-calculate already-issued invoices
- Does not auto-refund customers
- Does not auto-update reconciliation reports (manual process)

## Stage 5: Post-Deployment Success (If All Clear)

### Update Documentation
- [ ] Add note to RELEASE.md documenting fee rounding change
- [ ] Update runbook to reflect new default method
- [ ] Remove "old" rounding deprecation timeline (or set to 6 months)

### Retain Capabilities
- [ ] Keep `feeMinorOldRounding()` in codebase for at least 6 months
- [ ] Keep PRICING_ROUNDING_VERSION env var support active
- [ ] Plan deprecation timeline (post-deployment review meeting)

### Celebrate
- [ ] Thank finance team for validation
- [ ] Thank on-call team for monitoring
- [ ] Document what went well for future releases

---

## Quick Reference: Monitoring Indicators

| Indicator | Normal | Warning | Action |
|-----------|--------|---------|--------|
| Reconciliation report | Match within ±1 minor unit | Systematic bias ±2-5 minor units | Monitor trend |
| Customer disputes | None expected | >1 payment dispute | Investigate |
| Service errors | None | Pricing-related errors | Rollback if >0 |
| Invoice processing time | <100ms | >500ms | Check logs |

---

## Contact Information
- **Finance Lead**: [TBD]
- **On-Call Engineer**: [TBD] or check PagerDuty
- **Service Owner**: [TBD]
- **Escalation**: [Incident channel in Slack/Teams]
