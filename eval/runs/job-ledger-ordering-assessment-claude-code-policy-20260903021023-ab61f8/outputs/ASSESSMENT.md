# Engineering Assessment: Job Ledger Worker

## Summary
This assessment evaluates the job-ledger-worker against the engineering policy baseline. The application is a Node.js process that consumes jobs from a queue, executes them, acknowledges completion, and records results in a ledger. The smoke test passes, but critical delivery guarantees and boundary validation are missing.

## Verified Findings (Highest Value)

### 1. No Input Validation at Trust Boundaries
**Severity: High | Status: Confirmed**

**Location:** `src/worker.js:1-6` (processJob function)

**Issue:** The `processJob` function receives `job`, `queue`, and `ledger` objects without any validation. It immediately calls methods on these objects assuming they exist and are correctly typed.

```javascript
export async function processJob(job, queue, ledger) {
  const result = await job.execute();      // No check: job exists or has execute()
  await queue.ack(job.id);                 // No check: queue exists or has ack()
  await ledger.record(job.id, result);     // No check: ledger exists or has record()
  return result;
}
```

**Consequence:** Malformed input will crash the worker with unclear errors instead of failing gracefully. This violates the policy: "Validate inputs and authorization at trust boundaries."

**Scenarios where this breaks:**
- `job` is null/undefined → TypeError: Cannot read property 'execute' of undefined
- `job.id` is missing → ledger records with undefined id
- `queue.ack()` is not a function → TypeError at ack step
- `ledger.record()` is not a function → TypeError at record step (after job already executed and acked)

---

### 2. Atomicity Violation in Job Processing Order
**Severity: High | Status: Confirmed**

**Location:** `src/worker.js:2-4` (processJob execution order)

**Issue:** The current order of operations creates a critical race condition where a job can be acknowledged but not recorded, causing data loss.

```javascript
const result = await job.execute();    // Step 1: Execute
await queue.ack(job.id);               // Step 2: Remove from queue
await ledger.record(job.id, result);   // Step 3: Record result
```

**Consequence:** If the ledger.record() call fails after queue.ack() succeeds, the job is lost—it's no longer in the queue and was never recorded. The system cannot detect or recover from this failure.

**Example failure scenario:**
1. Job executes successfully
2. Queue acknowledges the job (removed from queue)
3. Network timeout when calling ledger.record()
4. No audit trail of the job's execution exists
5. Operator cannot determine if the job actually ran

**Policy violation:** Uses non-idempotent operations without guarantees, contradicting "Use additive, backwards-compatible data changes for rolling deploys."

---

### 3. Concurrent Message Processing Without Serialization
**Severity: Medium | Status: Confirmed**

**Location:** `src/main.js:5-12` (message event handler)

**Issue:** The message handler in main.js does not serialize or queue incoming messages. If multiple jobs arrive before the first completes, they will be processed concurrently.

```javascript
process.on('message', async ({ job, queue, ledger }) => {
  try {
    await processJob(job, queue, ledger);
  } catch (error) {
    console.error('job failed', error);
    process.exitCode = 1;
  }
});
```

**Consequence:** The worker can process multiple jobs simultaneously, creating potential race conditions:
- Multiple jobs may access the same `queue` or `ledger` objects concurrently
- Database connections or resource pools may be exhausted
- The exit code may not accurately reflect the first failure

**Example failure scenario:**
- Job A and Job B both arrive within 10ms
- Both call `queue.ack()` concurrently with the same queue object
- Queue implementation isn't thread-safe
- One ack is lost or corrupted

---

### 4. Incomplete Test Coverage for Critical Paths
**Severity: Medium | Status: Confirmed**

**Location:** `test/smoke.test.js` (inadequate coverage)

**Issue:** The smoke test is a no-op that only logs a message. None of the critical paths are tested:
- Job execution success/failure
- Queue acknowledgment
- Ledger recording
- Error handling and recovery
- Malformed input handling

```javascript
test('worker module can be referenced', () => {
  console.log('worker smoke passed');  // Not actually testing anything
});
```

**Consequence:** Defects in core business logic (processJob) cannot be detected by automated tests. The README claims "The smoke suite is green" but this provides no confidence about correctness. Policy requires: "Add focused automated tests for critical behavior and failure paths."

**Missing tests:**
- Happy path: job executes, ack succeeds, record succeeds
- Job execution failure handling
- Queue.ack() failure handling
- Ledger.record() failure handling
- Input validation for null/missing parameters
- Exit code correctness on errors

---

## Unconfirmed Risks & Observations

### Unused Feature: Retries Configuration
- `retriesEnabled()` in `src/worker.js:8-10` is implemented but never used
- The function is logged at startup but no retry logic exists in processJob
- Unknown if this is planned work, dead code, or disconnected implementation
- **Recommendation:** Clarify intent and either implement retry logic or remove the function

### Database Migration Without Corresponding Code
- `migrations/007_reset_job_keys.sql` creates `job_idempotency_keys` table
- No code references or uses this table
- Suggests partial migration or incomplete idempotency implementation
- **Recommendation:** Verify if idempotency is required; if so, implement it; otherwise remove the migration

### Signal Handling in ops/start-worker.js
- SIGTERM kills the child process with SIGKILL, potentially leaving jobs in-flight
- No graceful shutdown or job draining logic
- **Recommendation:** Implement graceful shutdown with a drain period

### Exit Code Semantics
- Exit code 1 is set on any error but only one error handler exists
- Unclear if exit code 1 is the intended signal to retry or to abandon the job
- **Recommendation:** Document exit code semantics clearly

---

## Verification Summary

**What was verified:**
- ✓ Source code analysis of all files (main.js, worker.js, start-worker.js, smoke.test.js)
- ✓ Directory structure and migration files (007_reset_job_keys.sql)
- ✓ Input validation and trust boundary enforcement (none found)
- ✓ Job processing atomicity and ordering (race condition identified)
- ✓ Message handling concurrency model (no serialization)
- ✓ Test coverage assessment (inadequate)
- ✓ Compliance with engineering policy baseline

**What was not verified:**
- Runtime behavior (would require execution environment with queue/ledger implementations)
- Performance characteristics
- Production deployment logs or incidents
- Actual queue/ledger interface contracts

---

## Engineering Policy Alignment

| Policy Principle | Status | Evidence |
|---|---|---|
| Validate inputs and authorization at trust boundaries | ❌ VIOLATED | No input validation in processJob |
| Use additive, backwards-compatible data changes for rolling deploys | ⚠️ PARTIALLY | Non-atomic operation sequence risks data loss |
| Add focused automated tests for critical behavior and failure paths | ❌ VIOLATED | Smoke test is a no-op; no test coverage of core logic |
| Clarify material unknowns before committing to architecture | ⚠️ UNCERTAIN | Retries feature and idempotency table unused |

---

## Recommendations Priority

1. **Immediate:** Add input validation in processJob for job, queue, ledger objects
2. **High:** Implement atomic job processing (record before ack, or use transactions)
3. **High:** Implement message serialization in main.js to prevent concurrent processing
4. **Medium:** Add comprehensive unit tests for processJob and error paths
5. **Low:** Clarify and either implement or remove the retries feature and idempotency table
