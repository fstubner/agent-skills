# Fee Rounding v2 Runbook

## Overview

This runbook covers deployment and rollback procedures for the fee rounding v2 release.

**Key facts**:
- v2 is the new default (invoice-total rounding)
- v1 is still available for rollback (per-line rounding)
- Both versions are tested and supported
- No code changes needed to switch between versions—only environment variables

## Pre-Deployment Checklist

- [ ] All tests pass locally: `npm test`
- [ ] Code reviewed for off-by-one errors
- [ ] Finance team has validated sample invoices with v2 fees
- [ ] Incident response is on call during deployment

## Canary Deployment (5% of pods)

### Step 1: Deploy code to staging
```bash
git merge main
npm test
```

### Step 2: Deploy to production (canary)
```bash
kubectl --context production apply -f k8s/ledger-api.yaml
# This deploys with default env: FEE_ROUNDING_VERSION=v2

# Wait for pods to come up
kubectl --context production rollout status deployment/ledger-api --timeout=5m
```

### Step 3: Monitor canary (4-6 hours)
```bash
# Watch for invoice generation errors
kubectl --context production logs -f deployment/ledger-api --tail=100

# Spot-check: finance team manually reviews 5-10 invoices
# - Do fees look reasonable?
# - Do line totals + fee match invoice total?
```

### Step 4a: Canary success → proceed to gradual rollout

**Gradual rollout**:
```bash
# Scale canary to 25% (e.g., from 2 pods to 0.5 pods, capped at 1):
kubectl --context production scale deployment/ledger-api --replicas=3

# After 2 hours with no issues:
kubectl --context production scale deployment/ledger-api --replicas=6

# After 2 more hours:
kubectl --context production scale deployment/ledger-api --replicas=12
```

### Step 4b: Canary failure → immediate rollback

**If invoices fail to generate or fees look wrong**:

#### Option 1: Rollback to previous image (fastest)
```bash
kubectl --context production rollout undo deployment/ledger-api
kubectl --context production rollout status deployment/ledger-api --timeout=5m
```

**Time to recovery**: ~1 minute  
**Effect**: All pods revert to previous image; invoices generated after this point use v1

#### Option 2: Switch to v1 without redeploying (if code supports it)
```bash
kubectl --context production set env deployment/ledger-api FEE_ROUNDING_VERSION=v1
kubectl --context production rollout restart deployment/ledger-api
kubectl --context production rollout status deployment/ledger-api --timeout=5m
```

**Time to recovery**: ~2 minutes  
**Effect**: Pods keep new code but use v1 fee calculation

#### Post-Rollback
1. Finance team identifies affected invoices (those issued during the rollback window)
2. Issue adjusting credits/debits to reconcile
3. Investigate root cause: was v1 actually correct, or was the v2 logic flawed?
4. Run full test suite against the bug and fix

## Post-Deployment Verification (next morning)

1. Nightly reconciliation runs automatically
2. Finance team reviews reconciliation report
3. Check for discrepancies between invoiced fees and payment processor records

**If reconciliation passes**:
- Release is successful
- Proceed to document learnings

**If reconciliation fails**:
- Immediately page on-call: `alerting team` (ASAP)
- Execute rollback (see Step 4b above)
- Do not issue new invoices until root cause is identified

## Verification During Rollout

### Invoice generation health check
```bash
# Pods should not report errors in logs
kubectl --context production logs deployment/ledger-api | grep -i error | head -20

# Verify endpoint returns valid JSON
curl -s http://ledger-api:3000/entries/test-123 | jq .
```

### Fee calculation spot check
Use database queries to verify a few invoices:

```sql
-- Count invoices by fee (sanity check for distribution)
SELECT
  fee_minor,
  COUNT(*) as count
FROM invoices
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY fee_minor
ORDER BY fee_minor DESC
LIMIT 20;

-- Compare against expected fee for a specific invoice
SELECT
  invoice_id,
  line_total_minor,
  fee_basis_points,
  calculated_fee_minor,  -- from your app
  expected_fee_v2_minor   -- recalculated in SQL
FROM invoices
WHERE created_at > NOW() - INTERVAL '1 hour'
LIMIT 5;
```

## Rollback Decision Tree

```
Did invoices generate successfully?
├─ No  → Immediate rollback (Option 1 or 2)
└─ Yes → Spot check: do fees look reasonable?
   ├─ No  → Immediate rollback
   └─ Yes → Continue gradual rollout
```

If you rolled back, answer these before re-deploying:
- [ ] Finance team found the bug in v2 logic
- [ ] Bug is fixed in code
- [ ] All tests pass, including regression tests
- [ ] Finance team has re-validated sample invoices

## Escalation

If uncertain at any point:
1. **Do not proceed** to next stage (e.g., don't scale beyond canary)
2. **Page the incident commander** or finance team lead
3. **Gather data**: logs, recent invoice samples, reconciliation reports
4. **Make decision** with stakeholders present

Erring on the side of caution is correct here—a rollback takes <1 minute.

## Communication Template

**Deployment Started**:
```
Deploying fee rounding v2 to canary (1-2 pods). Monitoring for 4-6 hours.
Finance team: expect potential spot-check questions about invoice fees.
Rollback available if needed.
```

**Canary Complete → Gradual Rollout**:
```
Canary passed ✓. Proceeding to gradual rollout (25% → 50% → 100% over 6-8 hours).
Monitoring continues. Finance team on standby.
```

**Rollback Initiated**:
```
Rolling back to v1 due to [reason].
Recovery time: ~1 minute. All pods reverted.
RCA and fix will follow.
```

**Full Rollout Complete**:
```
Fee rounding v2 is now live across all pods. Waiting for nightly reconciliation (runs at 02:00 UTC).
Finance team will review reconciliation report in the morning.
```
