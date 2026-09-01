# Operating the ledger API

## Signals

The service emits structured JSON logs with correlation IDs to stdout. Each request is tagged with `request_id` for end-to-end tracing.

**Critical signals to monitor:**
- `fee_mismatch`: Logged when calculated fee differs from expected (indicates rounding bug)
- `invoice_dispute`: Logged when customer contacts support about invoice amount
- `reconciliation_failed`: Daily reconciliation job against payment processor failed
- `http_5xx`: Any 500+ error in invoice generation endpoint

All signals carry `timestamp`, `request_id`, and `severity` fields. Parse from logs via structured JSON decoder (not regex).

**Known limitation:** Pre-2026 logs lack request_id field; do not assume traces are available for historical incidents.

## Alerts

- **Invoice generation latency > 2s (p95)** → Page on-call immediately. First response: check if payment processor is responding slowly or if pod is CPU-throttled.
- **Reconciliation job fails** → Page on-call within 15 minutes. The daily run is required to catch fee calculation bugs; silence this alert and invoices could be wrong for a full day before discovery.
- **fee_mismatch count > 0** → Page on-call within 5 minutes. This signal only appears if calculations are provably wrong; every occurrence is an incident.
- **Error rate > 1% on /entries** → Page on-call within 10 minutes. Transient 5xx may indicate memory leak or cascading failure.

## Failure modes

**Scenario: Fee calculation is inverted (charges 1 bps instead of configured amount)**
- **Symptom:** fee_mismatch logs appear; reconciliation reports 100x difference
- **Root cause:** Feature flag FEES_ROUND_TOTAL set to true and new rounding logic is buggy
- **Detection:** Happens in Phase 2 after flag flip; caught within 24h by reconciliation check
- **Recovery:** See RELEASE.md: flip FEES_ROUND_TOTAL back to false, invoices recalculate on next job run

**Scenario: Per-line rounding returns negative fee (data corruption)**
- **Symptom:** Logs show error in feeMinor() function, invoices fail to generate with 500 error
- **Root cause:** lineTotalsMinor contains corrupt or negative values upstream
- **Detection:** Real-time; http_5xx alert fires, reconciliation job fails
- **Recovery:** Investigate upstream invoice line data; may require code rollback if data model changed

**Scenario: Pod is OOM-killed during flag flip, reconciliation can't verify new calculation**
- **Symptom:** Reconciliation job hangs; alert pages but reconciliation never completes
- **Root cause:** Pod memory limit is too low for current invoice volume
- **Detection:** kubectl describe pod; check memory requests/limits
- **Recovery:** Scale up pod memory limits, restart reconciliation job manually

## Recovery

**Immediate behavior rollback (if new rounding is wrong):**
```bash
kubectl --context production set env deployment/ledger-api FEES_ROUND_TOTAL=false
```
Takes effect within 30 seconds. Invoices will recalculate using old per-line rounding on the next job run (typically within 5 minutes).

**Code rollback (if both old and new code are broken or corrupted):**
```bash
kubectl --context production rollout undo deployment/ledger-api
```
Takes effect within 30 seconds. Returns to previous image entirely; may need schema recovery if data changed.

**Data at risk:**
- Invoices generated while FEES_ROUND_TOTAL=true with buggy new rounding: must be invalidated and recalculated
- Fees already charged to customers during the window: reconciliation report identifies affected customers; finance must issue credits
- Reconciliation data is append-only; previous reconciliation records remain in the log and can be replayed after fix

**Verify recovery worked:**
1. Check fee_mismatch count in logs dropped to zero
2. Wait for next reconciliation job cycle (scheduled daily at 02:00 UTC); confirm it passes
3. Spot-check 5 random invoices generated after rollback against payment processor
