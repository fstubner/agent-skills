# Job Worker Assessment

## Summary

The job worker implements a simple claim-notify-complete loop with file-based persistence. The implementation satisfies the basic requirement but has **critical concurrency issues** that will cause problems at production scale (4 workers).

## Critical Issues

### 1. Race Condition in Job Claiming (High Severity)
**Location:** `src/queue.js` claimNext()

Multiple workers can claim the same job simultaneously:
- Worker A reads state, finds unclaimed job X
- Worker B reads state, finds the same unclaimed job X (before A's write)
- Both workers claim job X and proceed

**Impact:** Duplicate work, double-billing the partner, inconsistent state

The issue is that load/modify/save is not atomic. With 4 workers in production and a file-based store, races are likely under concurrent load.

### 2. Jobs Stuck in "Claimed" State (High Severity)
**Location:** `src/worker.js` runOnce(), `src/notify.js`

If `notifyPartner()` throws:
- Job is marked as claimed but not completed
- Process manager restarts the worker with a new workerId
- Restarted worker won't reclaim the job (it's already claimed by the old workerId)
- Job is permanently stuck; no automatic recovery

**Impact:** Job loss, incomplete billing notifications, manual intervention required

### 3. No Environment Validation (Medium Severity)
**Location:** `src/notify.js`

`process.env.PARTNER_WEBHOOK` is accessed without validation. If unset or malformed:
- Worker fails silently or with unclear error
- No indication that configuration is missing

**Impact:** Difficult debugging, potential production outage at startup

## Quality Issues

### Test Coverage (Medium Severity)
- Only 1 test covering the happy path
- No tests for `worker.js` (the main export)
- No test for concurrent claiming (the critical race condition)
- No test for notify failure scenarios
- No test for missing environment variables

**Impact:** Race conditions and error paths are unverified

### Data Integrity Risk (Medium Severity)
**Location:** `src/queue.js` save()

File I/O is not atomic:
- `fs.writeFileSync()` can be interrupted by process kill
- No rename-to-atomic pattern or append/rotate
- Partial writes could corrupt the jobs.json file
- 4 concurrent writers increase corruption risk

**Impact:** Potential data loss or corruption under restart scenarios

## Architectural Concerns

### Inadequate for Production Scale
- File-based job queue doesn't scale to concurrent writers
- No distributed lock mechanism
- No retry/dead-letter queue for failed notifications
- No metrics or observability for job status

### Unclear Error Semantics
- It's unknown whether `notifyPartner` can be safely retried (idempotent?)
- No explicit handling of transient vs permanent failures
- Process manager retries only via crash, not selective retry

## What Works

✓ Basic happy path (enqueue → claim → notify → complete)  
✓ Job state persistence  
✓ Worker isolation via claimedBy field (design is sound, implementation has races)  
✓ Minimal dependencies

## Recommendations Before Scaling

1. **Blocking:** Add atomic claiming (lock-based or compare-and-swap on job state)
2. **Blocking:** Handle notify failure by resetting claimedBy to allow reclaim
3. **Before deploy:** Validate PARTNER_WEBHOOK at startup
4. **Before deploy:** Add tests for concurrent claims and notify failures
5. **Nice to have:** Audit partner API contract (is it idempotent?)

## Verdict

**Do not scale to 4 workers in current form.** The race condition will cause duplicate claims under concurrent load. Fix atomic claiming and failure recovery before raising worker count.
