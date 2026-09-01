# Releasing the ledger API

Merging to `main` tests, builds, and rolls the new image out to every pod.

## This release: Fee rounding change

Fee rounding moves from per-line to once on the invoice total. Finance asked
for it and signed off on the new numbers.

**Risk level:** Medium. A wrong fee does not crash anything; invoices produce
normally and customers are charged, but billing disagrees with payment processor
reconciliation (discovered 12–24 hours later). See [OPERATIONS.md](OPERATIONS.md)
for observability plan.

## Deployment strategy

1. **Deploy the new code with the feature flag disabled** — the new fee
   calculation ships in the code, but `LEDGER_USE_NEW_FEE_ROUNDING=false`
   keeps the old per-line behavior live.

2. **Canary rollout at 5% traffic** — shift 5% of invoice requests to the new
   calculation for 1 hour. Monitor daily reconciliation report (see OPERATIONS.md).
   If metrics agree, proceed to full rollout. If metrics diverge, rollback via
   feature flag (step 4).

3. **Full rollout to 100%** — shift remaining 95% to new calculation. Continue
   monitoring reconciliation for 24 hours.

4. **Flip feature flag off to rollback (immediate, no redeploy)** — if
   reconciliation metrics show disagreement after canary or full rollout:

   ```bash
   kubectl --context production set env deployment/ledger-api \
     LEDGER_USE_NEW_FEE_ROUNDING=false
   ```

   Back on per-line rounding in seconds. Invoices produced during the bad
   window remain as written; no data is destroyed.

## Code rollback (last resort)

If the issue is not the fee calculation but a different bug introduced in this
commit, roll back the entire deployment:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

## Approval and observability gates

- **Pre-deploy:** Finance confirms sign-off on new numbers in this PR
- **Pre-canary:** Reconciliation pipeline is healthy and recent runs agree
  with payment processor
- **Post-canary:** Compare 1-hour canary reconciliation report to baseline
  (5% traffic should not shift aggregate fee by >0.01%). If pass, approve
  full rollout. If fail, execute feature flag rollback.
- **24-hour watch:** After full rollout, reconciliation must agree with
  payment processor. An alert fires if daily `|reconciliation_delta| > 0.05%`.
  On alert: execute feature flag rollback, page on-call, open incident.
