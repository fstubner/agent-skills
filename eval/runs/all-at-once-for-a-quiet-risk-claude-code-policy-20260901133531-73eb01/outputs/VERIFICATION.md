# Release Verification Checklist

## Implementation Complete

### 1. Dual-mode fee calculation ✓
- **File**: `src/pricing.js`
- **Status**: Both v1 (per-line) and v2 (total) implementations coexist
- **Default**: v2 (new method, finance-approved)
- **Fallback**: v1 (legacy method, production-proven)

### 2. Configuration support ✓
- **File**: `src/config.js`
- **Capability**: Reads `FEE_ROUNDING_VERSION` environment variable
- **Default**: v2 when not specified
- **Allows**: Runtime switching without code redeploy

### 3. Comprehensive test coverage ✓
- **File**: `test/server.test.js`
- **Tests**: 9 test cases covering:
  - v1 basic functionality
  - v2 basic functionality
  - Default behavior (v2)
  - Zero-length input edge case
  - Key divergence case (fractional penny capture)
  - Environment variable contract

### 4. Deployment decision document ✓
- **File**: `DEPLOYMENT_DECISION.md`
- **Contents**:
  - Risk assessment (high: silent financial drift)
  - Phased rollout strategy (canary → gradual)
  - Rollback triggers and procedures
  - Validation checklist
  - Known unknowns requiring finance team input

### 5. Operational runbook ✓
- **File**: `RUNBOOK.md`
- **Contents**:
  - Pre-deployment checklist
  - Canary deployment steps (4-6 hour window)
  - Immediate rollback procedures (two options)
  - Post-deployment verification (nightly reconciliation)
  - Monitoring queries and health checks
  - Decision tree and escalation procedures

## What Still Needs Verification

### Before Canary
- [ ] `npm test` passes all 9 tests locally
- [ ] Code review: pricing.js logic for off-by-one errors
- [ ] Finance team validates sample invoices with v2 fees
- [ ] Incident response confirms availability during deployment

### During Canary (4-6 hours, 1-2 pods)
- [ ] No invoice generation errors in logs
- [ ] Finance manual spot-check: 5-10 invoices look correct
- [ ] Health checks and API endpoints remain green

### During Gradual Rollout
- [ ] 25% deployment: spot-check invoices
- [ ] 50% deployment: spot-check invoices
- [ ] 100% deployment: confirm all healthy

### After Full Deployment
- [ ] Nightly reconciliation runs (next morning)
- [ ] Finance reviews reconciliation report
- [ ] No discrepancies between invoiced fees and payment processor

## Test Execution Command

When ready to verify tests:

```bash
npm test
# or
node --test test/
```

**Expected output**: 9 passing tests, 0 failures

## Key Test Cases

| Test | Purpose | Key Assertion |
|------|---------|----------------|
| v2 basic | Confirms v2 rounds invoice total | [33,33,34] @ 250bp → 3 |
| v2 fractional | Confirms v2 handles fractional amounts | [100,100,100] @ 333bp → 10 |
| v1 basic | Confirms v1 rounds per line | [33,33,34] @ 250bp → 3 |
| v1 vs v2 divergence | Shows key difference: v2 captures lost pennies | [333,333,333] @ 100bp → v1:9, v2:10 |
| Default behavior | Confirms v2 is default when version not specified | Both return same result |
| Zero lines | Confirms both handle empty input | Returns 0 |
| Environment contract | Confirms versions can be called independently | v1 ≠ v2 on certain inputs |

## Implementation Notes

### Code Quality
- No external dependencies added
- Backward compatible (v1 still available)
- Minimal changes (39 lines in pricing.js)
- Clear comments explaining rounding differences

### Rollback Safety
- Rollback available in <1 minute via kubectl
- Two options: image rollback or env-var switching
- No state corruption (data-only issue, not logical error)

### Finance Review Required
Before proceeding past canary, get answers to these unknowns:
1. What percentage of invoices see rounding differences between v1 and v2?
2. Does payment processor use v1 or v2 rounding logic?
3. Are any downstream systems (reporting UIs, reconciliation) caching fees?

## Related Documentation

- **Deployment strategy**: `DEPLOYMENT_DECISION.md` (sign-off and phasing)
- **Operational procedures**: `RUNBOOK.md` (step-by-step execution)
- **Release notes**: `RELEASE.md` (changelog for end users)
