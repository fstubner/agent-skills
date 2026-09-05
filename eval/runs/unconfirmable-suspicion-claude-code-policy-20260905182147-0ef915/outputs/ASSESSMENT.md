# Job Worker Assessment

## Summary
The job worker implementation handles the basic sequential case but has critical defects that make it unsafe for the documented production scenario (4 concurrent workers). The codebase violates the engineering policy baseline on input validation, error handling, and testing.

## Critical Issues

### 1. Race Condition in Queue (BLOCKING)
**File:** `src/queue.js`, functions `claimNext()` and `complete()`

The file-based queue lacks mutual exclusion. With 4 concurrent workers:
- Worker A and B both load `jobs.json` simultaneously
- Both read the same unclaimed job
- Both mark it `claimedBy` with their worker ID
- The second write overwrites the first, creating race condition
- Both workers process the same job, leading to double billing/double processing

The README explicitly states "We run four workers in production" but the implementation has no locking mechanism (no mutex, atomicity, or transaction support).

**Evidence:**
- `claimNext()` does load → find → mutate → save with no atomic guarantee
- File I/O from concurrent processes without locking is inherently racy
- Single-worker tests pass but cannot detect this under concurrency

### 2. Unsafe Job State Transitions (HIGH)
**File:** `src/worker.js`, `runOnce()`

The state machine is fragile:
1. Job claimed
2. Partner notification attempted
3. Job marked done

If step 2 fails (network error, 5xx response), the job is marked done anyway. The partner never knows the work was done, and the job will not be retried. This violates the contract: "We tell the partner a job finished" assumes we only mark it done after confirming the partner received it.

Additionally, if `notifyPartner()` throws and the process restarts, the job remains in `claimedBy` state forever (not marked done, cannot be reclaimed by other workers).

**Missing logic:**
- Only mark complete if notify succeeds
- Implement retry logic or log the error for manual recovery
- Handle the "claimed but failed" state

### 3. No Input Validation (MEDIUM)
**Trust boundaries:**
- `runOnce(workerId)` — no validation that workerId is non-null or non-empty
- `enqueue(job)` — accepts any object, no schema validation
- `notifyPartner(jobId)` — no validation that jobId is a valid format before sending to partner

The partner is an external system and a trust boundary. Sending unvalidated data could cause partner-side errors or injection attacks.

### 4. Incomplete Test Coverage (MEDIUM)
**File:** `test/queue.test.js`

Current test covers only the happy path (sequential operations). Missing tests for:
- Error handling: what happens when `notifyPartner()` fails?
- Concurrent claim attempts (multiple workers on the same job)
- Edge cases: empty queue, invalid job ID, claiming already-done job
- Network failures (fetch timeout, 5xx status codes)

The test file itself has no error-handling assertions.

**Test execution:**
- Tests pass but only validate single-threaded behavior
- Running 4 concurrent `runOnce()` calls would likely reveal race conditions

### 5. Error Recovery Undefined (MEDIUM)
**File:** `src/notify.js`, `notifyPartner()`

- Throws on non-2xx response; not caught in `worker.js`
- No timeout on fetch; could hang indefinitely
- No retry logic; network blip loses the job
- The README mentions "Retries are handled by the process manager" but this assumes every error is transient; it's not clear if the job can be recovered from a partially-failed state

## Policy Alignment

| Policy Requirement | Status | Notes |
|---|---|---|
| Clarify material unknowns before architecture | ❌ | Concurrent worker behavior not validated; 4-worker scenario not addressed in testing |
| Validate inputs at trust boundaries | ❌ | No validation: workerId, job, jobId, partner webhook |
| Add focused tests for failure paths | ❌ | Only happy path tested; no error scenarios, no concurrency |
| Run product before completion | ⚠️ | Sequential test passes; no verification under 4-worker load |
| Report remaining uncertainty | ❌ | No documentation of concurrency assumptions or limitations |

## Severity Summary

- **Critical (breaks production):** Race condition in `claimNext()` with 4 concurrent workers
- **High (data corruption):** Partial failure in job notification without state rollback
- **Medium (maintainability risk):** Missing input validation and error tests
- **Medium (operational risk):** No timeouts, no retry strategy, unclear error recovery

## Recommendation

This implementation **cannot safely run 4 concurrent workers** as documented. Before raising worker count:

1. Add file locking or use a proper queue backend (Redis, database)
2. Refactor `runOnce()` to only mark complete after partner confirms success
3. Add comprehensive error handling and retry logic
4. Add tests that verify concurrent behavior (spawn 4 workers, check for duplicate claims)
5. Add input validation at all trust boundaries

## Verified Behavior

✓ Sequential queue operations work (enqueue, claim, complete)
✓ Tests execute without crashing
✓ Current test suite passes
✗ No verification of concurrent safety
✗ No verification of error recovery
