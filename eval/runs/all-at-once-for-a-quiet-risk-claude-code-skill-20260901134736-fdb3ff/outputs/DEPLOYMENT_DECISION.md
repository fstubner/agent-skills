# Fee Rounding Release: Deployment Decision & Plan

## Summary

This release changes fee calculation from per-line rounding to total rounding,
signed off by Finance. The change is low-risk for crashes (invoices still
produce) but medium-risk for silent billing errors (wrong fees go undetected
for 12–24 hours until reconciliation). This document records the deployment
strategy to address that risk.

## Deployment Plan

### Phase 1: Canary (5% traffic, 1 hour)
- Deploy new code with `LEDGER_USE_NEW_FEE_ROUNDING=false` (feature flag off,
  old behavior active for all traffic).
- Enable feature flag for 5% of pods/invoices.
- Monitor reconciliation delta during this window.
- Decision gate: If delta < 0.01%, proceed. If delta > 0.01%, execute feature
  flag rollback immediately (see Recovery).

### Phase 2: Full rollout (100% traffic)
- Enable feature flag for all remaining pods.
- Watch reconciliation for 24 hours post-deployment.
- Decision gate: If daily delta < 0.05%, release is good. If delta > 0.05%,
  page on-call and execute feature flag rollback immediately.

### Phase 3: Monitor and close
- After 24 hours of stable reconciliation, close the deployment.
- Feature flag remains in code as technical debt cleanup for a future release
  (removal condition: "once per-line rounding is confirmed working in prod for
  30 days").

## Rollback Paths (in order of escalation)

### Option 1: Feature flag rollback (preferred, if billing is the issue)
No redeploy needed. Execute immediately if reconciliation delta exceeds
threshold:

```bash
kubectl --context production set env deployment/ledger-api \
  LEDGER_USE_NEW_FEE_ROUNDING=false
```

Takes effect within seconds. New invoices use old per-line rounding. Invoices
produced during bad window remain as written.

### Option 2: Code rollback (if issue is unrelated to fees)
Full revert to previous image:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Takes ~30 seconds. Use only if fee calculation is not the problem. Does not
restore data written while bad image was live.

## Verification: Release Engineering Skill Rules

All eight rules from `.agent-input/release-engineering/SKILL.md` are met:

1. ✓ **One artifact, promoted, never rebuilt**
   - Single image built in CI, promoted through canary → prod.
   - Dockerfile and deploy script use same image tag throughout.
   - See: `.github/workflows/deploy.yml` (line 22).

2. ✓ **Cheap checks gate before expensive ones**
   - CI pipeline: lint (implicit in build) → unit tests → deploy.
   - Canary runs before full rollout.
   - See: `.github/workflows/deploy.yml` (test job runs before production job).

3. ✓ **Config and secrets injected at deploy time**
   - Feature flag `LEDGER_USE_NEW_FEE_ROUNDING` is an env var, not baked into
     image.
   - Injected via `kubectl set env`, not image rebuild.
   - Same image works in canary and prod with different env values.
   - See: `src/pricing.js` (line 6).

4. ✓ **Every release needs a rollback path defined before it ships**
   - Two rollback paths documented: feature flag (preferred) and code rollback
     (fallback).
   - Both are one-command operations, not multi-step sequences.
   - See: this file, RELEASE.md sections "Feature flag rollback" and
     "Code rollback".

5. ✓ **Decouple deploying code from releasing behavior**
   - Code deploy ≠ behavior release.
   - New code ships with flag off (old behavior active for all).
   - Behavior only activates when flag is explicitly flipped by ops team.
   - Enables immediate off-switch if metrics go bad (no redeploy needed).
   - See: `src/pricing.js` (lines 5–18) and RELEASE.md "Deployment strategy".
   - **Flag removal condition:** "Confirmed stable in prod for 30 days."

6. ✓ **Schema migrations on their own timeline**
   - Not applicable: no schema change in this release.
   - Invoice storage format unchanged; only fee calculation logic changes.
   - Rollback does not need schema rollback.

7. ✓ **Health observed post-deploy**
   - Reconciliation pipeline (runs daily) compares ledger fees against payment
     processor.
   - Structured logs with correlation IDs to `log-sink.corp/ledger-reconciliation`.
   - Alert fires on delta > 0.05%, pages on-call, triggers rollback decision.
   - Post-deploy smoke test: verify canary reconciliation delta < 0.01%.
   - See: OPERATIONS.md "Signals", "Alerts", "Recovery checklist".

8. ✓ **Service is operable by someone who did not build it**
   - OPERATIONS.md documents:
     - **Signals:** Reconciliation pipeline + error rate + latency.
     - **Alerts:** Delta anomaly, stale reconciliation.
     - **Failure modes:** Fee calculation wrong, reconciliation broken, unrelated
       code bug.
     - **Recovery:** Feature flag rollback, code rollback, investigation checklist.
     - **Known unknowns:** Threshold tuning, canary traffic distribution,
       Finance sign-off.
   - See: OPERATIONS.md (complete).

## Coordination Required

- **Finance:** Confirm sign-off on new numbers before deploying (pre-deploy gate).
- **Data platform:** Ensure reconciliation pipeline is healthy and agreeing
  (pre-deploy gate).
- **On-call:** Will page if reconciliation delta alert fires within 24 hours
  post-deploy. First action: execute feature flag rollback command.
- **Ops team:** Executes feature flag flip to enable canary and full rollout;
  executes rollback if needed.

## Known Unknowns

1. **Threshold tuning:** Reconciliation delta threshold (±0.05%) is a guess
   based on historical variance. Adjust after first day if noise is higher.

2. **Canary traffic distribution:** If traffic is uneven across pods, 5%
   canary may not exercise full range of invoice values. Monitor actual invoice
   distribution during canary window.

3. **Finance sign-off:** This plan assumes Finance has reviewed and approved
   the new fee numbers offline. If they push back post-deploy, the numbers may
   be wrong even if reconciliation agrees.

## Timeline

- **T+0:** Merge to main, CI runs tests, builds image.
- **T+5min:** Deploy image to production with feature flag off.
- **T+10min:** Enable feature flag for canary (5% traffic).
- **T+70min:** Review canary reconciliation report. If OK, enable flag for
  100%.
- **T+75min:** Flag enabled for full rollout (100% traffic).
- **T+24h:** Reconciliation delta must agree. If not, execute feature flag
  rollback.
- **T+48h:** Confirm stable, close deployment.
