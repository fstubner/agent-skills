# Job Worker Assessment

## Summary
The job worker implementation is a single-file orchestration of three modules (queue, notify, worker) that claim jobs, notify a billing partner, and mark jobs complete. The system is intended to run as 4 concurrent workers with process-manager-driven restarts. While the architecture is simple and the happy path works, there are several critical issues that make it unsafe for production use with multiple workers.

## Critical Issues

### 1. Race Condition in Job Claiming (Severity: High)
**Location**: `src/queue.js:claimNext()`

The load-modify-save pattern is not atomic. When multiple workers run concurrently:
- Worker A reads the file, finds unclaimed job J, sets `claimedBy = 'w1'`, saves
- Worker B (simultaneously) read the file before A's save, also finds J, sets `claimedBy = 'w2'`, saves
- B's save overwrites A's claim; both workers now process the same job

This violates the core guarantee that each job is claimed by exactly one worker. With 4 production workers, this is likely to manifest as duplicate processing and overbilling.

**Test coverage**: The single test (`queue.test.js`) runs sequentially and never tests concurrent claims.

### 2. Partial Failure Inconsistency (Severity: High)
**Location**: `src/worker.js`

The flow is: `claimNext() → notifyPartner() → complete()`. If any step fails:
- If `notifyPartner()` succeeds but `complete()` throws: job marked as claimed but not done; billing partner thinks it's done. State mismatch.
- If `notifyPartner()` fails: `complete()` is never reached (error propagates). Process manager restarts the worker, which re-claims the same job (now marked `claimedBy` but not `done`) and tries to notify again.
- If `complete()` fails due to file write error: job is marked done on disk but may not be on retry, or in-flight notification might re-send.

No transaction boundary or idempotency safeguard exists.

### 3. Duplicate Notifications on Restart (Severity: High)
**Location**: `src/worker.js`, `src/notify.js`

When `notifyPartner()` throws, the process manager restarts the worker. The restarted worker calls `claimNext()` which returns the same job (still marked `claimedBy` the old worker ID, but that's not checked). It calls `notifyPartner()` again, sending duplicate notifications to the billing partner.

**Assumption violated**: The comment references partner docs at `https://partner.example/docs` but makes no guarantee about idempotency. Most webhook systems are not idempotent by default.

### 4. Missing Environment Variable Validation (Severity: Medium)
**Location**: `src/notify.js:4`

`process.env.PARTNER_WEBHOOK` is used without validation. If the variable is unset:
- `fetch("undefined/job-complete", ...)` is called, which fails with a network error, but the error message is cryptic
- Should validate at startup or at trust boundary entry

### 5. No Timeout on External Network Call (Severity: Medium)
**Location**: `src/notify.js:5`

The `fetch()` call to the billing partner has no timeout. If the partner's endpoint hangs or is slow, the worker process hangs indefinitely. With 4 workers and high job volume, this could freeze the entire work pipeline.

### 6. Fragile Job ID Generation (Severity: Low)
**Location**: `src/queue.js:17`

Job IDs are assigned as `j${state.jobs.length + 1}`. If the `.data/jobs.json` file is ever corrupted, truncated, or manually edited, the ID counter becomes unreliable. Should use a monotonic counter or UUID.

## Test Coverage Gaps

1. **No error path testing**: No tests for `notifyPartner()` failures, `complete()` failures, or missing env vars.
2. **No concurrency testing**: The single test is synchronous and sequential. Cannot catch race conditions.
3. **No worker integration tests**: `runOnce()` is never tested end-to-end.
4. **No timeout testing**: Cannot verify behavior when partner is slow/hung.

## Design Observations

### Strengths
- Simple, readable code
- Clear separation of concerns (queue, notify, worker)
- Minimal dependencies (only Node.js stdlib)

### Weaknesses per Engineering Policy
- **Validate inputs at trust boundaries**: PARTNER_WEBHOOK is not validated; workerId/jobId are not validated before use.
- **Clarify material unknowns**: No clarity on notification idempotency, retry semantics, or failure recovery.
- **Focused automated tests for failure paths**: Only happy path; no error scenarios.
- **Run product/tests before completion**: Tests pass for happy path, but system is unsafe under concurrent load.

## Recommendations for Safe Production Deployment

1. **Atomic claiming**: Use file locking (e.g., `fs.promises.open(..., 'r+')` with advisory lock) or a proper database to make claimNext atomic.
2. **Idempotent notification**: Add a unique idempotency key (job ID) to the partner request; or ensure the worker does not retry the same notification (e.g., mark `notified` before calling partner).
3. **Timeout the fetch call**: Add `{ signal: AbortSignal.timeout(30000) }` to the fetch options.
4. **Validate env at startup**: Check `PARTNER_WEBHOOK` in a startup hook before any worker runs.
5. **Add concurrency tests**: Use `Promise.all()` to spawn multiple concurrent claims and verify that each job is claimed exactly once.
6. **Review transaction boundaries**: Decide whether a job can be partially notified, or if the entire flow (claim → notify → mark done) must succeed or fail atomically.

## Verdict

**Not ready to scale to 4 concurrent workers.** The race condition in job claiming will cause duplicate work and overbilling under concurrent load. The partial-failure window and lack of idempotency will cause inconsistent state. Recommend fixing the atomic claiming and idempotent notification before deploying at scale.
