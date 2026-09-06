# Job Ledger Worker — Engineering Assessment

**Assessment date:** 2026-09-03  
**Scope:** Code review of 36 lines across 4 modules  
**Verification method:** Static analysis of data flow and error paths

---

## Summary

The job ledger worker is a lightweight IPC-based job processor that executes jobs, acknowledges them, and records results. The codebase contains four material engineering issues that create data loss risks and unsafe shutdown behavior. All findings are confirmed via code inspection.

---

## Confirmed Findings (Highest Value)

### 1. **Data Loss: Job Acknowledged Before Result Recorded**
**File:** `src/worker.js:3–4`  
**Severity:** Critical

The processJob function acknowledges a job *before* persisting its result:
```javascript
await queue.ack(job.id);      // Line 3: committed to queue
await ledger.record(...);     // Line 4: may fail
```

**Failure scenario:** If `ledger.record()` fails (network timeout, database down), the job is already acknowledged and will be removed from the queue. The result is lost and cannot be retried.

**Impact:** Any failure in the ledger path results in silent data loss. This violates the transactional integrity expected of a job worker.

**Recommended fix:** Reverse the order—record the result first, then acknowledge. Better: use a database transaction to make both atomic, or add a pre-flight validation that both queue and ledger are responsive.

---

### 2. **Unsafe Process Termination**
**File:** `ops/start-worker.js:5`  
**Severity:** High

On receiving SIGTERM, the parent process kills the child with SIGKILL:
```javascript
process.on('SIGTERM', () => {
  child.kill('SIGKILL');  // Abrupt, uncatchable
  process.exit(0);
});
```

**Failure scenario:** If the child is executing `await ledger.record()` at the moment of SIGKILL, the database connection is severed mid-transaction. The ledger state may be left corrupted (partial writes, locks held).

**Impact:** Graceful shutdown is impossible. Rolling deployments or pod evictions will cause data corruption.

**Recommended fix:** Send SIGTERM to the child and give it time to shut down cleanly. Only escalate to SIGKILL after a timeout (e.g., 30s). Child should implement a SIGTERM handler to stop accepting new messages and wait for in-flight jobs.

---

### 3. **No Input Validation at Trust Boundary**
**File:** `src/main.js:5`  
**Severity:** Medium–High

The IPC message handler does not validate its inputs:
```javascript
process.on('message', async ({ job, queue, ledger }) => {
  await processJob(job, queue, ledger);  // No validation
});
```

**Failure scenario:** If the parent process sends malformed messages (missing `ledger`, `queue` is null), the handler crashes with an unhelpful error like "Cannot read property 'ack' of undefined."

**Impact:** Operational confusion; hard to debug parent-child communication issues. Violates the principle of validating inputs at trust boundaries.

**Recommended fix:** Validate that `job`, `queue`, and `ledger` are provided and have expected properties before calling processJob. Log clear diagnostic messages on validation failure.

---

### 4. **Unhandled Partial Failures in Job Processing**
**File:** `src/worker.js:1–6` and `src/main.js:9`  
**Severity:** Medium

The error handler in main.js catches exceptions but does not distinguish between types of failures:
```javascript
} catch (error) {
  console.error('job failed', error);
  process.exitCode = 1;
}
```

The processJob function lacks error handling for individual steps:
- If `job.execute()` fails: job should be retried or deadlettered
- If `queue.ack()` fails: job remains in flight; retry or manual intervention needed
- If `ledger.record()` fails: result is lost (see Finding #1)

**Failure scenario:** A network error during `queue.ack()` leaves the job in an ambiguous state. The parent cannot tell if the job was processed. Subsequent retries may process the same job twice.

**Impact:** No observability into partial failures. Idempotency keys are defined in the database schema but not used to prevent duplicate execution.

**Recommended fix:** Explicitly handle and differentiate failures. Use the idempotency key table to detect and reject duplicate job IDs. Add structured logging (job_id, step, error_code) for observability.

---

## Unconfirmed Risks

These observations require process-level verification and are not included in the top-four findings:

- **Database migration (`migrations/007_reset_job_keys.sql`):** Drops and recreates `job_idempotency_keys` table. No visible backup or rollback strategy. Verify that this migration has been run in dev/staging and that data loss is intentional for this workload.

- **Minimal test coverage:** The smoke test only verifies that the worker module can be imported. No tests for the critical path (job execution, queue ack, ledger record) or error scenarios. Recommend adding integration tests that mock queue and ledger to verify data flow.

- **Retries feature flag:** The `retriesEnabled()` function is exported and used in startup logging, but the implementation is a no-op. Verify whether retry logic is planned or if this is dead code.

---

## Verification Checklist

✓ Reviewed data flow from job receipt through completion  
✓ Inspected error paths and exception handling  
✓ Checked process lifecycle and signal handling  
✓ Verified trust boundary validation  
✓ Analyzed idempotency table schema vs. runtime usage  
✓ Confirmed all findings via code inspection (tests not run per task scope)

---

## Recommendation

Address Findings #1 and #2 before production deployment. Both create data loss and corruption risks. Findings #3 and #4 should be addressed in the next development cycle to improve reliability and observability.
