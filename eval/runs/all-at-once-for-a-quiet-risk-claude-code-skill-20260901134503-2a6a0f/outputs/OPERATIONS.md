# Operations Runbook: Ledger API

## Signals

The ledger API emits health and fee calculation correctness through:

- **Reconciliation output**: Structured JSON report comparing calculated fees (from `feeMinor()`) against payment processor's charged fees, published hourly to `ledger-metrics.reconciliation.latest` topic with correlation IDs per invoice batch. This is the primary signal for fee calculation correctness. A feed that stops flowing indicates a calculation or reporting crash.

- **Invoice generation error rate**: Structured logs (JSON with correlation IDs) from `/invoice` endpoints. Tracked in logs under `event: "invoice_generated"` or `event: "invoice_failed"` with `service: "ledger-api"` tag. Error rate >0.1% (any invoice generation failure) warrants investigation, as invoices failing to generate completely mask fee errors.

- **Request latency**: Histogram of P50, P95, P99 latencies on GET `/entries/:id` and POST `/invoice` endpoints (emitted via structured logs, correlation ID per request). A spike >500ms on invoice generation suggests the new fee calculation (if enabled) is unexpectedly expensive; check if `ENABLE_NEW_FEE_CALC` flag is on.

**Known unknowns**: We do not yet have a signal for whether the payment processor is actually receiving and processing the invoices, only that reconciliation ran. If the payment processor's ingest is down, reconciliation will show large drift even with correct fees. Escalate fee-related drift to the payment processor team for status.

## Alerts

- **Page on-call if**: Reconciliation shows ≥0.5% total fee drift (dollars, not percentage of fees) OR any invoice generation error. First response: check if ENABLE_NEW_FEE_CALC flag is on in the current deployment. If on and drift is ≥0.5%, follow "Reconciliation drift detected (flag on)" in Failure Modes.

- **Do not alert on**: Single invoices with <0.01 cent drift (floating point rounding in the payment processor itself is normal). The threshold is a batch phenomenon, not per-invoice.

## Failure modes

### Reconciliation drift detected (flag on)

**Symptom**: Reconciliation report shows invoices where `calculated_fee` differs from `processor_fee` by ≥0.5% total.

**Timeline**: Fee calculation errors are invisible until reconciliation runs nightly. Drift is discovered 12–24h after the bad image ships or the flag flips on.

**Response**:
1. Disable the flag immediately (sec-level response):
   ```bash
   kubectl --context production set env deployment/ledger-api ENABLE_NEW_FEE_CALC=false
   ```
   This reverts all new invoices to the old calculation. The service keeps running; pods do not restart. Invoices generated after the flag disables will use the old calculation going forward.

2. Find the first invoice affected: look at the earliest timestamp in the reconciliation report where drift started.

3. Contact Finance. The invoices generated between first-bad and flag-disable need human review (they were charged incorrectly). Finance determines: charge the customer the difference, refund them, or accept the loss depending on the direction and size.

4. Once Finance approves remediation, file an incident in #incidents with the timeline and the root cause (see Failure Modes below).

### Reconciliation drift detected (flag off, code deployed)

**Symptom**: Reconciliation shows drift after a new image deploy but before the flag was ever on. This means the flag defaulted to on, or an old deployment with the new calculation is still live.

**Response**:
1. Verify the flag setting in the current deployment:
   ```bash
   kubectl --context production get env deployment/ledger-api ENABLE_NEW_FEE_CALC
   ```
2. If the output is blank or "true", immediately set it to false (see "Reconciliation drift detected (flag on)" step 1).
3. If the output is already "false", the drift is from a previous deploy that's still in pod cache. Force a full pod restart:
   ```bash
   kubectl --context production rollout restart deployment/ledger-api
   ```
4. If drift does not clear after restart, escalate to the ledger team—this suggests a data corruption or a bug in the flag check itself.

### Invoice generation failures

**Symptom**: Invoice generation error rate >0.1%, or a customer reports "invoice not found" after hours (past the sync window with the payment processor).

**Response**:
1. Check if invoices are timing out (P95 latency spike). If yes, check if ENABLE_NEW_FEE_CALC is on. The new calculation over large line-item batches can cause timeouts. Disable the flag and retry the invoice.
2. If error rate is high but latency is normal, check logs for the error message. Common causes: database connection pool exhausted (restart pods with smaller batch sizes), or the payment processor's invoice schema changed (contact their API team).
3. If a single invoice repeatedly fails, check if it has an unusual structure (e.g., >10,000 line items, fees rounding to >2 decimal places). The new calculation uses `Math.round()` which may not handle edge cases in the legacy fee structure.

### Post-deploy health check stuck or unhealthy

**Symptom**: The CI/CD pipeline's post-deploy health gate doesn't clear within 5 minutes, or shows "reconciliation check failed."

**Response**:
1. The health gate waits for reconciliation to complete (it runs hourly). If you deployed at 10:47am, the next reconciliation might not start until 11:00am. This is not an error; wait for the next hourly run.
2. If the gate is still stuck 2 hours after deploy, reconciliation itself may be stalled. Check the `ledger-metrics.reconciliation.latest` topic—is the latest message >2 hours old? If yes, contact the metrics team. If no, the gate's alert logic is broken; skip it and monitor manually for 24h using the Signals above.

## Recovery

### Rollback if code is broken (not fee-related)

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about 30 seconds. Pods restart with the old code and old data (no data is lost). Use this if the new code crashes or causes non-fee issues.

**What's at risk**: Invoices generated during the bad deployment may have been sent to the payment processor. If you rolled back within minutes, those invoices may be duplicates when the correct ones are sent. Coordinate with the customer support team.

### Rollback if fee calculation is wrong (flag path)

```bash
kubectl --context production set env deployment/ledger-api ENABLE_NEW_FEE_CALC=false
```

Existing invoices stay as they were. New invoices use the old calculation immediately (no restart needed). This is the preferred recovery because it's fast and doesn't discard the new code.

**What's at risk**: Invoices generated between the flag flip and disabling will have the wrong fee. Finance must decide per-invoice remediation (see Failure Modes, "Reconciliation drift detected").

### Restart if pods are stuck

```bash
kubectl --context production rollout restart deployment/ledger-api
```

Kills all pods and starts fresh with the current code and env vars. Reconciliation reports will briefly drop (while pods are starting) but resume once ready. Use this only if logs suggest a pod-level issue (stuck file descriptor, process leak, etc.); do not use as a reflexive troubleshoot for every issue.
