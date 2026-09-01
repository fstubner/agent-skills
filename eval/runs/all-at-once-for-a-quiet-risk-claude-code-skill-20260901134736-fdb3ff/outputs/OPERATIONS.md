# Operating the ledger API

## Signals

**Reconciliation pipeline** — Runs daily at 2am UTC. Compares invoices
produced by ledger API against payment processor records for the previous day.
Outputs structured JSON log (corr-id tracked) with per-invoice deltas in
minor units to `log-sink.corp/ledger-reconciliation` with fields:
- `invoice_id` — the invoice reconciled
- `ledger_fee_minor` — fee computed by ledger API
- `processor_fee_minor` — fee from payment processor
- `delta_minor` — ledger - processor (usually 0 or ±1 due to rounding)
- `timestamp_utc` — when reconciliation ran

**Error rate** — per-endpoint 5xx responses to `monitoring.corp` tagged by
`endpoint=*` and `status=500`. Baseline < 0.5% over any 5-minute window.
Does not catch a wrong fee (invoices produce successfully).

**Request latency** — p99 latency for POST /invoices to `monitoring.corp`.
Baseline < 200ms. Not affected by fee calculation change.

## Alerts

**Reconciliation delta anomaly** — If daily reconciliation aggregate delta
exceeds ±0.05% of total volume, page on-call with severity `critical`. First
response: check if this release is live. If yes, execute feature flag rollback
immediately (see RELEASE.md). Then open incident to investigate whether the
fee calculation is wrong or reconciliation pipeline is wrong.

**No reconciliation run for 30 hours** — If `log-sink.corp/ledger-reconciliation`
has no new records for 30 hours, alert with severity `warning`. First
response: check reconciliation pipeline health (out of scope for ledger API).

## Failure modes

**Fee calculation is wrong** — New rounding method produces fees that don't
match payment processor expectations. Symptom: reconciliation delta aggregate
grows day-over-day, correlating with the release timestamp. Invoices continue
producing. Customers charged wrong amounts silently.
- Observability: Reconciliation pipeline catches this within 24 hours.
- Recovery: Feature flag rollback (RELEASE.md step 4). This stops new
  invoices from using wrong calculation. Invoices produced during bad window
  remain as written; Finance team decides whether to issue credits.

**Reconciliation pipeline is broken** — Pipeline fails, hangs, or produces
wrong comparison logic. Symptom: reconciliation runs stop appearing in logs,
or delta noise exceeds ±0.01% on a stable release. This is not a ledger API
failure and is out of scope; page the data platform team.

**Code bug unrelated to fees** — Some other change in this commit breaks
invoice creation. Symptom: error rate spikes or latency increases immediately
post-deploy, or requests start returning 500s. Invoices do not produce.
- Observability: Error rate alert fires within 5 minutes.
- Recovery: Code rollback (RELEASE.md "Code rollback" section).

## Recovery

### Feature flag rollback (fee calculation issue)

```bash
kubectl --context production set env deployment/ledger-api \
  LEDGER_USE_NEW_FEE_ROUNDING=false
```

Restores per-line rounding within seconds. No redeploy. Invoices produced
after this command use old calculation. Those produced during the bad window
remain as written — Finance decides on credits/corrections offline.

### Code rollback (unrelated bug)

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on previous image in ~30 seconds. Only use if the issue is not the fee
calculation. Does not restore data (invoices, ledger entries) written while
bad image was live.

### If reconciliation pipeline is down

Out of scope; escalate to data platform team. Do not attempt to "fix" ledger
API as a workaround.

### Investigation checklist

1. What does reconciliation delta show today vs. baseline?
   - Check `log-sink.corp/ledger-reconciliation` for the last 48 hours.
   - Look at per-invoice deltas. Are they uniformly biased (e.g., always +2)?
     That suggests the fee calculation is wrong. Random noise near ±1 is normal.
   
2. When did the delta change?
   - Correlate timestamp to release deployments (check `kubectl rollout history
     deployment/ledger-api --context production`).
   - If delta shifted after this release's deploy timestamp, the issue is in
     this code. Execute feature flag rollback immediately.

3. Are invoices still producing?
   - Check ledger API error rate. If it's still < 0.5%, invoices are
     producing, but fees might be wrong.

4. Are customers complaining?
   - If customers report wrong charges and reconciliation delta correlates,
     it's a fee calculation issue. Execute feature flag rollback, then
     coordinate with Finance on credits.

### Known unknowns

- **Threshold tuning:** The reconciliation delta threshold (±0.05%) is a
  guess based on historical reconciliation noise. After the first day of
  this release, review actual day-over-day variance and adjust the alert
  threshold if needed.
- **Canary traffic split:** The 5% canary split assumes traffic is uniform
  across pods. If traffic distribution is uneven (e.g., one pod handles 50%),
  the canary may not exercise the full range of invoice values. Monitor
  canary deltas even if they look small.
- **Finance sign-off on numbers:** This deployment assumes Finance has
  reviewed and approved the new fee numbers offline. If Finance pushes back
  post-deploy, the numbers may be wrong even if reconciliation agrees.
  Coordinate with Finance before treating reconciliation agreement as "all
  good."
