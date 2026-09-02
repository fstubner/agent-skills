# Job Worker Assessment

## Summary
The job worker implementation has **critical concurrency issues** that will cause failures when running multiple workers in parallel. The current design is unsuitable for production use with 4 concurrent workers.

## Critical Issues

### 1. Race Condition in Job Claiming
**Location**: `queue.js:claimNext()`

The claiming mechanism has no synchronization:
```javascript
const state = load();
const job = state.jobs.find((j) => !j.claimedBy && !j.done);
job.claimedBy = workerId;
save(state);
```

**Problem**: Multiple workers can claim the same job due to non-atomic file operations.
- Worker A loads state, finds job1 (unclaimed)
- Worker B loads state (before A saves), finds job1 (still unclaimed)
- Worker A saves state with job1 claimed by A
- Worker B saves state with job1 claimed by B (overwrites A's change)
- Both workers process the same job, causing:
  - Duplicate notifications to the billing partner
  - Double-billing
  - Potential data inconsistencies

### 2. Orphaned Jobs on Notify Failure
**Location**: `worker.js:runOnce()` 

The sequence lacks atomicity:
```javascript
const job = claimNext(workerId);      // job marked claimed
await notifyPartner(job.id);          // may throw
complete(job.id);                      // never reached if notify fails
```

**Problem**: If `notifyPartner()` fails or throws:
- The job remains in "claimed" state permanently
- `claimNext()` skips claimed jobs: `!j.claimedBy && !j.done`
- The job is never retried, even when the worker restarts
- Work is silently lost

### 3. Duplicate Notifications on Process Crash
**Location**: `worker.js:runOnce()` and `queue.js:complete()`

If the process crashes between `notifyPartner()` and `complete()`:
- The partner received the notification
- The job is not marked complete
- On restart, the job is still claimed (see issue #2), so it's not retried
- The job hangs indefinitely despite partner already processing it

Alternative scenario with race condition: Two workers both claim the same job and both call `notifyPartner()`, causing duplicate notifications even if they serialize on `complete()`.

### 4. No Retry Mechanism for Failed Operations
**Problem**: 
- Failed `notifyPartner()` calls cause immediate job abandonment
- No Dead Letter Queue or retry backoff
- No alerting or visibility into stuck jobs

## Secondary Issues

### 5. Incomplete Error Handling
- `notifyPartner()` throws on non-OK status but provides minimal context
- No logging of which job failed or when
- No recovery strategy beyond process restart

### 6. No Job ID Collisions Handling
- Job IDs are sequential: `j${state.jobs.length + 1}`
- If `.data/jobs.json` is corrupted or reset while jobs are in-flight, ID collisions could occur

## Risks with 4 Concurrent Workers
- **Duplicate work**: Same job claimed and processed by multiple workers
- **Silent failures**: Lost jobs that never complete
- **Data corruption**: Multiple concurrent writes to `jobs.json` can corrupt the file
- **Double-billing**: Partner webhook called multiple times for the same job
- **Unreliable queue**: Cannot guarantee exactly-once processing semantics

## Recommended Actions Before Scaling
1. Implement file locking or use a database with transactions
2. Make notify + complete atomic (all-or-nothing)
3. Add a retry queue for failed notifications with backoff
4. Implement Dead Letter Queue for permanently failed jobs
5. Add comprehensive logging and alerting
6. Add idempotency keys to partner notifications to prevent double-billing
7. Test with concurrent worker scenarios before production use

## Conclusion
**Do not increase worker count** until concurrency safety is implemented. The current architecture will experience job loss and duplicate processing with multiple workers.
