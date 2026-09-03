# Engineering Assessment: Job Ledger Worker

**Assessment Date:** 2026-09-03  
**Scope:** Full codebase (src/, ops/, migrations/, test/)

## Summary

This document reports the four highest-value confirmed findings from a deep engineering review of the job ledger worker. The worker is responsible for consuming job messages from a queue, executing them, acknowledging completion, and recording results in a ledger. Critical reliability issues were identified in process lifecycle management, signal handling, and data consistency paths.

---

## Confirmed Findings

### 1. **Process Continues Running After Fatal Error** (Critical)

**File:** `src/main.js:10`

**Issue:**  
The IPC message handler catches exceptions and sets `process.exitCode = 1`, but **does not call `process.exit()`**. The worker process remains alive and continues listening for additional messages despite encountering an error during job processing.

**Failure Scenario:**  
A job fails due to database connectivity or a ledger recording error. The catch block logs the error and sets exit code, but the process keeps running. The parent process (ops/start-worker.js) does not detect the failure. Subsequent messages are processed by a worker in an unknown/inconsistent state.

**Impact:**  
- Parent process has no signal that the worker has failed
- Worker may continue operating with corrupted internal state
- Cascading failures on subsequent jobs
- Difficult to detect in production—process appears healthy to external monitoring

**Code:**
```javascript
// src/main.js lines 6-11
try {
  await processJob(job, queue, ledger);
} catch (error) {
  console.error('job failed', error);
  process.exitCode = 1;  // ← Does not exit; just sets code
}
```

---

### 2. **Abrupt Process Termination Without Graceful Shutdown** (Critical)

**File:** `ops/start-worker.js:4-7`

**Issue:**  
The SIGTERM handler immediately kills the child process with `SIGKILL` and exits, with no grace period. If a job is being processed when the signal arrives, it is forcibly terminated mid-operation without allowing the message handler to complete.

**Failure Scenario:**  
A deployment sends SIGTERM to restart the worker. If a job is actively being processed (lines 2–4 of src/worker.js executing), the kill occurs before the ACK and ledger.record calls complete. Result: the job is either acked without being recorded in the ledger, or partially recorded with the queue entry already removed, leaving the ledger out of sync with the queue.

**Impact:**  
- Job loss: job acked but not recorded in ledger
- Duplicate execution: job never acked, so it reprocesses
- Ledger-queue inconsistency
- Data corruption during routine deployments

**Code:**
```javascript
// ops/start-worker.js lines 4-7
process.on('SIGTERM', () => {
  child.kill('SIGKILL');  // ← Immediate kill; no grace period
  process.exit(0);
});
```

---

### 3. **No Input Validation on Message Handler** (High)

**File:** `src/main.js:5`

**Issue:**  
The message handler destructures `job`, `queue`, and `ledger` from the incoming message without validating that these properties exist. If the parent process sends a malformed message, the worker will fail with a cryptic TypeError instead of a clear validation error.

**Failure Scenario:**  
Parent process sends a message with a missing `ledger` property (due to a configuration bug). The worker attempts to call `ledger.record()` on undefined, raising "TypeError: Cannot read property 'record' of undefined". The error is logged, but there's no indication that the input was invalid—debuggers will see the message as internal worker corruption, not a contract violation.

**Impact:**  
- Difficult to diagnose configuration or contract errors
- No early detection of parent-process bugs
- Increased debugging time in production
- Silent failures if only some messages have the required fields

**Code:**
```javascript
// src/main.js lines 5-6
process.on('message', async ({ job, queue, ledger }) => {
  // ← No validation: assumes all three properties exist
  try {
    await processJob(job, queue, ledger);
```

---

### 4. **Unsafe Concurrent Database Migration** (High)

**File:** `migrations/007_reset_job_keys.sql:1-2`

**Issue:**  
The migration drops and recreates the `job_idempotency_keys` table without transactional protection or coordination with active workers. If a worker is checking idempotency keys or inserting new ones during the migration, a race condition occurs.

**Failure Scenario:**  
A migration runs while workers are actively processing jobs. A worker's idempotency key check (e.g., in job.execute()) occurs after the DROP but before the CREATE, or the CREATE completes while a worker has a prepared insert statement pending. This results in a constraint violation (duplicate key insert) or the worker's insert silently succeeds with no idempotency protection, causing duplicate job execution.

**Impact:**  
- Duplicate job execution (jobs run twice with the same idempotency key)
- Migration failures with constraint violations
- Silent loss of idempotency guarantees during deploys
- Data inconsistency in downstream systems

**Code:**
```sql
-- migrations/007_reset_job_keys.sql
DROP TABLE job_idempotency_keys;
-- ↑ No safeguards; concurrent workers may fail or lose idempotency
CREATE TABLE job_idempotency_keys (job_id text PRIMARY KEY);
```

---

## Unconfirmed Risks (Not Reported Above)

The following are potential issues that cannot be confirmed without additional context:

- **Ledger Record Ordering:** The sequence `execute → ack → record` assumes these operations are atomic from the queue's perspective. If there is asynchronous replication or delayed persistence in the queue or ledger, partial failures between these steps are possible but cannot be verified from code alone.

- **Queue ACK Semantics:** The code calls `queue.ack()` immediately after `job.execute()` completes. If the queue implementation's ACK is not durable or not ordered, messages could be lost or reprocessed. This depends on the queue's contract, which is not visible in this codebase.

- **Message Handler Concurrency:** The worker appears to expect one message at a time (serial message handling). If the parent process sends multiple messages simultaneously or if Node.js delivers multiple 'message' events concurrently, race conditions could occur. Current code structure suggests serial handling, but this is implementation-dependent.

---

## Verification Summary

- **Process Lifecycle:** Confirmed that error handling does not exit the worker; inspected all catch blocks and signal handlers in ops/ and src/
- **Signal Handling:** Confirmed SIGKILL is sent without delay; reviewed ops/start-worker.js line-by-line
- **Input Validation:** Confirmed no defensive checks on destructured message properties; src/main.js uses direct destructuring with no guards
- **Database Migrations:** Confirmed that 007_reset_job_keys.sql uses unprotected DROP/CREATE without concurrency safeguards; reviewed full migration file
- **Test Coverage:** Noted that smoke test only validates module reference (6 lines of test code); no integration tests for error paths or signal handling

