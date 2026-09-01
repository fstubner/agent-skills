# Pre-Deployment Checklist: Fee Rounding Change

Use this checklist to verify readiness before merging to main.

## Code Review

- [ ] **Pricing Logic**: Review both `feeMinor()` (new) and `feeMinorLegacy()` (rollback) in `src/pricing.js`
  - New algorithm rounds once on total (correct per finance team)
  - Legacy algorithm rounds per line (old behavior, for rollback)
  - Both are syntactically correct and logically sound

- [ ] **Integration Point**: Identify where `feeMinor()` is called from (currently not in src/server.js)
  - Update: Confirm that the ledger API actually uses `feeMinor()` in invoice generation
  - This is the missing piece: the API needs to call this function

## Test Verification

- [ ] **Run Test Suite**: `npm test`
  - All tests in `test/pricing.test.js` pass
  - Existing tests in `test/server.test.js` pass
  - No new warnings or errors

- [ ] **Test Coverage**: 
  - New tests validate both algorithms
  - Edge cases covered: empty arrays, zero amounts, large amounts
  - Rounding direction verified for fractional amounts
  - Algorithmic differences documented in test comments

## Build Verification

- [ ] **Docker Build**: `docker build -t registry.internal/ledger-api:test .`
  - Build completes successfully
  - No security vulnerabilities reported
  - Image layers are reasonable in size

## Finance Signoff

- [ ] **Fee Numbers**: Finance team has reviewed and approved
  - New algorithm produces expected fee amounts
  - Example calculations match finance expectations
  - No hidden assumptions about tax, currency, or rounding direction

- [ ] **Documentation**: Stakeholders understand the change
  - Finance team aware of the algorithm difference (per-line vs. total)
  - Operations team briefed on monitoring requirements
  - Support team aware this is a tracked change (for incident response)

## Deployment Prerequisites

- [ ] **Rollback Path 1 (Code)**: `feeMinorLegacy()` exists and can be imported
  - If needed: change import to `feeMinorLegacy`, test, merge
  - Timeline: 5-10 minutes from decision to live

- [ ] **Rollback Path 2 (Cluster)**: `kubectl rollout undo` tested
  - Cluster context confirmed: `kubectl --context production`
  - Undo command runs successfully (tested in non-prod if possible)
  - Timeline: ~30 seconds from decision to live

- [ ] **Monitoring Plan**: Team knows what to watch
  - Same-morning check: Finance reviews invoices
  - Nightly reconciliation: Payment processor check happens as scheduled
  - Morning-after: Finance team reviews reconciliation report
  - Escalation path defined if discrepancies found

## Documentation Complete

- [ ] **DEPLOYMENT_DECISION.md**: Outlines change, risk, and rollout
- [ ] **IMPLEMENTATION_SUMMARY.md**: Tracks what was completed
- [ ] **README.md**: Mentions pricing.js location (already done)
- [ ] **RELEASE.md**: Already documents this change (already done)

## Final Checks

- [ ] **No Secrets**: Confirm no API keys, passwords, or credentials in code/comments
- [ ] **No Regressions**: Existing tests still pass
- [ ] **Git Status Clean**: `git status` shows expected files
- [ ] **Commit Message**: Ready to describe change: "Add fee rounding change with legacy algorithm for rollback"

## Sign-Off

**Engineer:** ________________  
**Date:** ________________  
**Ready to merge:** [ ] Yes [ ] No

---

## Immediate Post-Merge Actions

Once merged to main, GitHub Actions will automatically:
1. Run `npm test` 
2. Build Docker image
3. Deploy to all pods

**Your job:** Monitor for 24 hours per DEPLOYMENT_DECISION.md Phase 3.

---

## If Stuck

**Question: Where is `feeMinor()` actually called?**  
Search: `grep -r "feeMinor" src/` to find all imports and usages. It should be called from invoice generation logic. If it's not being used, the test deployment won't exercise the new code.

**Question: How do I test locally?**  
```bash
npm install
npm test
docker build -t test:local .
```

**Question: How do I rollback if reconciliation fails?**  
See DEPLOYMENT_DECISION.md "Rollback Procedures" section. Two options:
1. Code-level: Edit to use `feeMinorLegacy`, test, merge (5-10 min)
2. Cluster-level: `kubectl rollout undo` (30 sec)
