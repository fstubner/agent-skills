# Engineering Assessment: Job Ledger Worker

**Assessment Date**: 2026-09-03  
**Scope**: Focused analysis of core job processing logic, queue interaction, and graceful shutdown  
**Policy Baseline**: Validated inputs at trust boundaries, idempotency constraints, and failure path reliability

---

## Executive Summary

The job ledger worker implements a critical processing pipeline for queued jobs. Four high-value issues were confirmed through code inspection. All involve data consistency, error recovery, or graceful degradation — properties essential in a distributed system processing critical work.

---

## Confirmed Findings

### 1. **Job Acknowledgment Ordering Violates Ledger Invariant** (Critical)

**Location**: `src/worker.js:1-6`

**Issue**: The job is acknowledged to the queue *before* being recorded in the ledger:
```javascript
const result = await job.execute();
await queue.ack(job.id);                    // ← ACK sent first
await ledger.record(job.id, result);        // ← Record sent after
```

**Failure Scenario**: If `ledger.record()` fails after `queue.ack()` succeeds (network timeout, database unavailable), the job is marked as processed in the queue but never recorded in the ledger. The ledger, which should be the source of truth for completed work, is now inconsistent with the queue state. Recovery requires manual intervention.

**Impact**: Violates idempotency invariant; creates unrecoverable state where job is lost from both queue and ledger's view of processed work.

**Correct Pattern**: Record to ledger first (or ensure both operations are treated as an atomic unit), then acknowledge to queue. This ensures the ledger always reflects committed work.

---

### 2. **Retry Logic Declared but Never Used** (High)

**Location**: `src/worker.js:8-10` and `src/main.js:14`

**Issue**: The `retriesEnabled()` function exists and is logged at startup, but retry logic is never implemented in the job processing flow. When a job fails:

```javascript
// In main.js
process.on('message', async ({ job, queue, ledger }) => {
  try {
    await processJob(job, queue, ledger);    // No retry wrapping
  } catch (error) {
    console.error('job failed', error);
    process.exitCode = 1;                    // Immediate exit, no retry attempt
  }
});
```

**Failure Scenario**: Transient failures (temporary database unavailability, network blip, brief lock contention) cause permanent job failure. The job exits the worker without retry even when `RETRIES_ENABLED=true`. Depending on queue behavior, the job is either re-queued (causing re-execution from scratch, losing partial state) or discarded.

**Impact**: Reduces reliability for transient fault scenarios; signal and infrastructure for retries exist but are not wired into the failure path.

---

### 3. **Execution Failure Leaves Job in Undefined State** (High)

**Location**: `src/worker.js:1-6` and `src/main.js:5-11`

**Issue**: If `job.execute()` throws an error, the exception propagates without acknowledgment or ledger recording:

```javascript
export async function processJob(job, queue, ledger) {
  const result = await job.execute();         // ← If this throws
  // Following lines never execute
  await queue.ack(job.id);                    // Not called
  await ledger.record(job.id, result);        // Not called
  return result;
}
```

**Failure Scenario**: A job with transient errors (temporary service downtime) fails to execute, throws an exception, and exits the worker process. The job is neither acknowledged to the queue nor recorded in the ledger. Depending on queue implementation, it may:
- Be re-queued immediately, causing tight retry loop
- Be stuck in "processing" state indefinitely
- Be lost if the queue has no visibility into worker crashes

**Impact**: No clear recovery path; job state becomes opaque to both queue and ledger systems.

---

### 4. **Child Process Killed Without Graceful Shutdown** (Medium)

**Location**: `ops/start-worker.js:4-7`

**Issue**: When the parent process receives SIGTERM, it forcefully kills the child worker:

```javascript
process.on('SIGTERM', () => {
  child.kill('SIGKILL');                     // ← SIGKILL = non-catchable termination
  process.exit(0);
});
```

SIGKILL cannot be caught; the child process has no opportunity to:
- Finish processing an in-flight job
- Commit partial state to the ledger
- Acknowledge or reject a job to the queue
- Implement custom cleanup logic

**Failure Scenario**: During a rolling deployment or scale-down, a SIGTERM arrives while the child is executing `ledger.record()` or another critical operation. SIGKILL terminates the process immediately, leaving the job in an inconsistent state (partially recorded, not acknowledged, or vice versa).

**Impact**: Potential data loss or inconsistency during graceful shutdown scenarios; no graceful degradation when infrastructure signals the process to shut down.

**Correct Pattern**: Send SIGTERM to the child first, allow it to finish in-flight work or enter a safe state, then force termination if it doesn't respond.

---

## Unconfirmed Observations

These risks are plausible but cannot be confirmed without runtime behavior or integration context:

- **No Input Validation**: `processJob()` does not validate that `job`, `queue`, and `ledger` implement the expected interface (methods: `execute()`, `ack()`, `record()`). Passing incorrect objects would produce cryptic errors. Mitigation: add guard clauses or type validation at trust boundary.

- **Silent Test Coverage Gap**: The test suite (`test/smoke.test.js`) does not exercise the core `processJob()` logic. It only verifies the module can be referenced. No assertions on happy path, error paths, or state transitions.

- **Environment-Driven Retry Flag with No Implementation**: The `RETRIES_ENABLED` environment variable is read but controls no behavior. This suggests incomplete refactoring or deferred work.

---

## Verification Summary

- ✓ Reviewed job processing order and acknowledged idempotency constraints
- ✓ Traced execution flow through error cases in both `worker.js` and `main.js`
- ✓ Examined signal handling contract in `ops/start-worker.js`
- ✓ Confirmed retry infrastructure exists but is not connected to failure path
- ✓ Identified data consistency risk when ledger record fails after queue ack
