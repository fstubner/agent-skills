# Engineering Assessment: Job Ledger Worker

## Summary
This assessment evaluated a job queue worker that consumes jobs, executes them, acknowledges completion, and records results to a ledger. Analysis identified four critical engineering issues affecting reliability and data durability.

---

## Confirmed Findings (Ranked by Severity)

### 1. Queue Acknowledgment Before Ledger Recording (Data Loss Risk)
**File:** `src/worker.js:1-6`  
**Severity:** Critical

The operation order in `processJob` violates durability guarantees for job queue systems:
```javascript
const result = await job.execute();
await queue.ack(job.id);        // ← Removes from queue
await ledger.record(job.id, result);  // ← Records state
```

**Failure scenario:** If `ledger.record()` fails after `queue.ack()` succeeds, the job is permanently lost—removed from the queue but not recorded in the ledger. Recovery is impossible.

**Correct pattern:** Record to ledger first (durable state), then acknowledge queue (removal). This ensures atomicity: either the job is both recorded and acknowledged, or neither.

---

### 2. Unhandled Errors in Critical Operations (Silent Failures)
**File:** `src/main.js:5-12` and `src/worker.js:1-6`  
**Severity:** High

Errors from critical operations are not caught:
```javascript
async ({ job, queue, ledger }) => {
  try {
    await processJob(job, queue, ledger);
  } catch (error) {
    console.error('job failed', error);
    process.exitCode = 1;  // ← Sets exit code but continues running
  }
}
```

**Failure scenario:** If `queue.ack()` or `ledger.record()` fails inside `processJob`, the error propagates to the message handler. The process logs the error and sets `exitCode = 1`, but continues running in an undefined state. The worker becomes unreliable—a job may be half-processed with unknown ledger state.

The exit code is set but `process.exit()` is not called. The process continues its event loop, potentially processing the next message with corrupted internal state.

---

### 3. Improper Graceful Shutdown (Data Corruption Risk)
**File:** `ops/start-worker.js:4-7`  
**Severity:** High

The parent process immediately force-kills the child on SIGTERM with no graceful shutdown period:
```javascript
process.on('SIGTERM', () => {
  child.kill('SIGKILL');  // ← Hard kill, no cleanup opportunity
  process.exit(0);
});
```

**Failure scenario:** When the parent receives SIGTERM (e.g., during deployment or maintenance), it sends SIGKILL to the child. The child has zero opportunity to:
- Complete pending job execution
- Flush ledger writes to disk
- Clean up open file handles or database connections
- Acknowledge in-flight queue messages

This risks losing in-progress work and corrupting ledger state.

**Correct pattern:** Send SIGTERM to the child and wait (with timeout) for graceful shutdown. Only force-kill if the child doesn't exit within the timeout window.

---

### 4. Unused Retry Mechanism and Idempotency Code (Dead Feature)
**File:** `src/worker.js:8-10`, `src/main.js:14`, and `migrations/007_reset_job_keys.sql`  
**Severity:** Medium-High

The codebase contains infrastructure for retries and idempotency that is never used:
- `retriesEnabled()` function is defined and logged at startup
- `job_idempotency_keys` table exists in migrations
- Neither is referenced in job processing logic

**Failure scenario:** The application claims retries are available (via the startup log) but provides no retry behavior. Failed jobs are never retried. If a job execution is transient (network timeout, temporary resource unavailable), the job is permanently lost. The idempotency table sits unused, creating confusion about whether duplicate executions are safe.

---

## Unconfirmed Risks (Not Included in Top 4)

- **Timeout handling:** `job.execute()` has no timeout. A hung job could block the worker indefinitely. This risk could not be confirmed without knowing the job contract and queue semantics.
- **Message handler contract:** The `message` event handler assumes `job`, `queue`, and `ledger` objects are always passed. Missing or malformed objects would crash. Without visibility into the parent process, this risk cannot be fully confirmed.
- **Async resource cleanup:** No cleanup handlers (SIGINT, uncaughtException) exist for emergency termination. Risk is present but severity depends on system dependencies.

---

## Verification Summary

This assessment was conducted through:
1. **Code review** of operation ordering in `processJob()` against job queue best practices
2. **Error handling analysis** of exception propagation paths from critical operations
3. **Signal handling audit** of shutdown behavior in the spawn harness
4. **Feature completeness check** comparing defined exports against actual usage sites

All four findings are **confirmed through direct code analysis** and represent actionable engineering risks affecting reliability and data durability.
