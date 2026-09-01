# Fee Rounding Release — Deployment Plan

## Summary

This release changes fee rounding from per-line to once on the invoice total. The risk of silent failure (wrong invoices reconcile badly the next morning) requires a staged rollout with a feature flag and explicit verification before activation.

## Implementation

### Code changes
- `src/pricing.js`: Added feature flag support to `feeMinor()` function
  - Defaults to **old behavior** (per-line rounding) via `FEES_ROUND_TOTAL=false` environment variable
  - Accepts runtime override via `options.useNewRounding` parameter for testing
  - Both old and new implementations preserved in code

### Documentation

**RELEASE.md** — Deployment strategy
- Risk level: HIGH (silent failure mode)
- Flagged: YES with explicit reasoning (risk mitigation for financial calculations)
- Two-phase rollout:
  - Phase 1: Deploy code with flag OFF (no behavior change, 0–24h)
  - Phase 2: Finance verifies, flip flag ON if correct (24h+ after Phase 1 passes verification)
- Rollback paths defined as literal commands:
  - Code rollback: `kubectl rollout undo` (if both old and new are broken)
  - Behavior rollback: `kubectl set env FEES_ROUND_TOTAL=false` (if new rounding is wrong)
- Verification signals defined (invoice error rate, reconciliation success, customer disputes)
- Flag removal condition: After 30 days at 100% traffic with zero discrepancies, remove flag entirely

**OPERATIONS.md** — Runbook for operating the service
- Signals: How to detect fee calculation bugs (fee_mismatch tag), reconciliation failures, customer disputes
- Alerts: Thresholds and escalation paths for each critical signal
- Failure modes: Specific scenarios (inverted fees, corrupted data, OOM during flag flip) with detection and recovery steps
- Recovery procedures: Literal commands for behavior and code rollback, data at-risk assessment

## Release engineering compliance

Verified against SKILL.md rules:

1. **One artifact, promoted** ✓ — kubectl rollout undo uses previous image as single source of truth
2. **Cheap checks first** ✓ — Test files present; unit tests run before deploy
3. **Config injected at deploy time** ✓ — FEES_ROUND_TOTAL is environment variable, not baked into image
4. **Rollback defined before shipping** ✓ — RELEASE.md documents both code and behavior rollback as literal commands
5. **Decouple deploy from release** ✓ — Feature flag enables new behavior on-demand; decision recorded with reasoning
6. **Schema migrations separate** ✓ — Not applicable; no schema changes
7. **Health observed after deploy** ✓ — Verification signals and alerts defined; recovery procedures specify what to verify
8. **Operations runbook** ✓ — OPERATIONS.md covers signals, alerts, failure modes, and recovery steps

## Timeline

**Phase 1 (Day 0–1)**
- Merge to main; image builds and deploys to production
- `FEES_ROUND_TOTAL=false` (default)
- System uses old per-line rounding; zero behavior change for customers
- Run canary traffic or tests against new code path to verify no crashes

**Phase 2 (Day 1+)**
- Finance team queries invoices from Phase 1; cross-checks against payment processor
- If match: Deploy team sets `FEES_ROUND_TOTAL=true`
- Monitor for 24h: fee_mismatch logs, reconciliation results, customer disputes
- If any issue: Set `FEES_ROUND_TOTAL=false` (no redeploy needed)

**Phase 3 (Day 30+)**
- After 30 days clean at 100% traffic, remove feature flag from code entirely
- Inline new rounding as only behavior; old code deleted

## What to watch during Phase 2

- `reconciliation_failed` alert — if triggered, roll back immediately
- `fee_mismatch` logs — should be zero; if any appear, roll back
- `invoice_dispute` volume — baseline from previous 30 days; spike → roll back
- Invoice generation latency p95 — should be similar to pre-deploy baseline
- Error rate on /entries endpoint — should be < 1%
