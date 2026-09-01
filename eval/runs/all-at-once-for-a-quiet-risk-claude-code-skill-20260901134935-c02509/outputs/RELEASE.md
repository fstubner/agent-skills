# Releasing the ledger API

Merging to `main` tests, builds, and rolls the new image out to every pod.

## This release: fee rounding calculation change

**Risk level:** HIGH (silent failure on wrong calculation)  
**Flagged:** YES — risk mitigation for financial calculation with no exception path

### What changed

Fee rounding moves from per-line to once on the invoice total. Finance team requested this change and signed off on the expected output. However, if the calculation is wrong, invoices are produced and reconciliation disagrees with the payment processor the next morning with no crash or alert to catch the error.

### Deployment strategy

The new rounding logic is deployed behind a feature flag that **defaults to the old (per-line) behavior**.

**Phase 1 (0–24h): Deploy with flag OFF**
1. Merge to main; new image rolls out with `FEES_ROUND_TOTAL=false` (the default)
2. System continues using old per-line rounding; no behavior change for customers
3. New code path exercised only in canary traffic or tests

**Phase 2 (after finance verification): Flip flag to enable new rounding**
1. Finance team queries invoices from Phase 1 and verifies calculation against payment processor
2. If numbers match expected values, set `FEES_ROUND_TOTAL=true` in production
3. Monitor metrics for 24h (see **Verification signals** below)
4. If discrepancies appear, immediately set `FEES_ROUND_TOTAL=false` (flag flip, no redeploy)

### Rolling back

**Code rollback** (if both old and new code are broken):
```bash
kubectl --context production rollout undo deployment/ledger-api
```
Back on the previous image in about thirty seconds. Does not restore data written while the bad image was live.

**Behavior rollback** (if new rounding is wrong):
```bash
kubectl --context production set env deployment/ledger-api FEES_ROUND_TOTAL=false
```
Reverts to old per-line rounding immediately without a redeploy. Invoice generation continues at the next opportunity with old calculation.

### Verification signals

Before flipping the flag, finance must confirm:
- Invoice totals from a 24h sample match payment processor records exactly
- No pattern of over/under-charges on any customer segment
- Reconciliation report shows zero discrepancies

After flag flip, watch:
- Invoice error rate (log any line with `fee_mismatch` tag)
- Customer disputes mentioning invoice amounts (tag: `invoice_dispute`)
- Reconciliation job success rate (daily run; pages on failure)

If any of these degrade, trigger behavior rollback immediately.

### Flag removal condition

After 30 days at 100% of traffic with zero discrepancies, remove the feature flag entirely:
- Delete `useNewRounding` parameter and `FEES_ROUND_TOTAL` env check
- Inline new rounding as the only behavior
- Rollback will revert to previous image if needed

This ensures the flag does not become permanent branching code.
