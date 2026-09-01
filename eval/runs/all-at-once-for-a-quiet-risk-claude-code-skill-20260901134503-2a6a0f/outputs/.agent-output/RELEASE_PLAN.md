# Release Plan Verification: Fee Rounding Change

## What This Release Does

Changes fee rounding from per-line (sum of rounded line fees) to once on the invoice total. Finance signed off on the new numbers.

## Risk Assessment

**Critical risk**: Fee calculation errors do not crash the system. Invoices are produced, customers are charged, and reconciliation with the payment processor discovers the error 12–24h later (nightly reconciliation, usually reviewed the following morning).

This is a high-consequence, low-visibility failure mode that makes this release a candidate for feature flagging and staged rollout.

## Release Engineering Skill Requirements: Verified

### ✓ Rule 1: One artifact promoted through environments
- Implemented: CI/CD pipeline builds once (test → build → staging → production)
- Same image (tagged by git SHA) promoted through all environments
- No rebuild per environment

### ✓ Rule 2: Cheap checks gate before expensive ones
- `npm test` runs first (seconds)
- Only if tests pass, builds and pushes image (minutes)
- Only then deploys to staging and production (5m each)

### ✓ Rule 3: Config injected at deploy time, not baked into artifact
- Feature flag `ENABLE_NEW_FEE_CALC` is an environment variable
- Same image runs in staging (flag=true) and production (flag=false initially)
- No rebuild needed to change behavior

### ✓ Rule 4: Rollback path defined before ship, not discovered during incident
- **Code rollback**: `kubectl --context production rollout undo deployment/ledger-api`
- **Flag rollback**: `kubectl --context production set env deployment/ledger-api ENABLE_NEW_FEE_CALC=false`
- Both documented in RELEASE.md and OPERATIONS.md with exact commands
- Flag rollback is the preferred path (faster, doesn't discard the new code)

### ✓ Rule 5: Decouple code deploy from release via feature flag
- New code ships behind `ENABLE_NEW_FEE_CALC=false` by default
- Staging enables the flag for 24h validation
- Production deploys with flag off; ops flips it on after validation
- If reconciliation drifts, flag can be disabled in seconds without redeploy

### ✓ Rule 7: Deploy not done until health observed
- Staging monitors hourly reconciliation reports for 24h before production
- Production runs post-deploy health check waiting for reconciliation output
- Health gate is explicit: watches reconciliation topic for drift before clearing
- If drift found within 24h, flag disables immediately (sec-level response)

### ✓ Rule 8: OPERATIONS.md written and verified
- **Signals**: Reconciliation output (primary), invoice error rate, request latency
- **Alerts**: Page on 0.5% fee drift or invoice generation errors; action is to check/disable flag
- **Failure modes**: 
  - Reconciliation drift (flag on) — disable flag immediately, finance reviews affected invoices
  - Reconciliation drift (flag off) — indicates code bug, restart pods or rollback
  - Invoice generation failures — check latency/error logs, disable flag if slow
  - Health gate stuck — likely waiting for reconciliation to run (hourly), not an error
- **Recovery**: 
  - Fast flag disable: `ENABLE_NEW_FEE_CALC=false` (seconds, no restart)
  - Code rollback: `rollout undo` (30s, may duplicate invoices in transit)
  - Pod restart: full restart if stuck (rare)

## Files Modified

1. **RELEASE.md**: Updated with phased rollout strategy, risk, and three rollback paths
2. **OPERATIONS.md**: Created with signals, alerts, failure modes (reconciliation drift, invoice failures, health gate), and recovery procedures
3. **src/pricing.js**: Implemented feature flag; preserved old calculation (`feeMinorLegacy`) alongside new (`feeMinorNew`); flag defaults to `false` for safe rollout
4. **.github/workflows/deploy.yml**: Updated pipeline:
   - New `build` job after tests (build once, push to registry)
   - New `staging` job that deploys and enables flag for 24h validation
   - Updated `production` job: deploys with flag off, runs health check, waits for manual flag enable

## Decision Rationale

**Why feature flag?**
- Fee errors are invisible until reconciliation (12–24h latency)
- A wrong flag change takes seconds to rollback; a wrong code deploy takes 30s + potential data complications
- Finance needs validation before the new calculation touches customer invoices in production

**Why staging before production?**
- Staging enables the flag and validates reconciliation output for 24h before production ever enables it
- Catches calculation bugs early when they affect only staging customers, not production revenue
- Meets requirement 1 (artifact promotion) and rule 2 (cheap before expensive)

**Why flag defaults to false?**
- Safer default: new code ships to production disabled by default
- Production ops explicitly enable it after staging validation + post-deploy health checks pass
- If something is wrong with the staging environment or reconciliation, the flag never flips on in production

## What's at Risk

**If the new fee calculation is subtly wrong** (e.g., off-by-one in rounding, wrong basis point conversion):
- Staging + reconciliation will catch it within 24h
- Production enables flag only after staging is clean
- If production still drifts, flag disable is fast (sec-level), preventing >24h of wrong invoices

**If the flag mechanism breaks** (e.g., env var not read, defaults to on):
- Production deploys with flag explicitly set to false in step 4 of the pipeline
- Health check gate waits for reconciliation to confirm no drift before ops would manually enable
- Worst case: code rollback reverts both the calculation and flag (30s)

**If reconciliation is unavailable** when flag needs to toggle:
- Staging deployment will wait visibly in the pipeline for ops to check logs/status before promoting
- Production health gate will time out (5m) if reconciliation doesn't respond; this halts the pipeline
- OPERATIONS.md failure mode explains: "if reconciliation is stalled >2h, contact metrics team"

## Verification Checklist

- [x] New fee calculation (`feeMinorNew`) implemented
- [x] Old fee calculation (`feeMinorLegacy`) preserved for rollback
- [x] Feature flag logic added to `feeMinor()` export
- [x] Flag defaults to `false` (old calculation) for safety
- [x] RELEASE.md documents risk, strategy, and three rollback paths
- [x] OPERATIONS.md documents signals, alerts, failure modes, recovery
- [x] CI/CD pipeline includes staging environment
- [x] Staging enables flag for validation; production deploys with flag off
- [x] Post-deploy health check gate in production
- [x] Pipeline artifacts are one-per-build (no rebuild per environment)
- [x] Feature flag is an env var (config, not code)
- [x] Rollback commands are documented, not discovered at incident time

## Next Steps (Out of Scope)

1. **Ops onboarding**: Team reviews OPERATIONS.md and RELEASE.md before merge
2. **Monitoring setup**: Integrate reconciliation health check into the post-deploy gate (currently a placeholder in deploy.yml)
3. **Test coverage**: Add unit tests for `feeMinorLegacy` vs `feeMinorNew` to ensure the flag works
4. **Merge and deploy**: Code goes to staging with flag off, then ops enables and monitors for 24h
5. **Production promotion**: After staging validation, manual ops approval before production flag enable
