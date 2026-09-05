# Job Worker Assessment

## Summary
The current job worker implementation has a **critical race condition** that will cause data loss and duplicate job processing when scaling to multiple concurrent workers. The file-based state system with unatomic read-modify-write operations is not safe for concurrent access.

## Critical Issues

### 1. Race Condition in Job Claiming (HIGH SEVERITY)
**Location**: `src/queue.js:23-30` in `claimNext()`

**Issue**: Multiple workers can claim the same unclaimed job due to non-atomic state updates.

**Scenario with 4+ workers**:
1. Worker A calls `claimNext()`, reads state, finds job X with `claimedBy: null`
2. Worker B calls `claimNext()` before Worker A saves, also finds job X with `claimedBy: null`
3. Both workers update job X's `claimedBy` to their respective IDs
4. Both workers save state (one overwrites the other's change)
5. Both workers process the same job, call `notifyPartner()` twice

**Result**: Duplicate billing charges, inconsistent state.

### 2. Non-Atomic File Operations (HIGH SEVERITY)
**Location**: `src/queue.js:11-13` in `save()` and `src/queue.js:6-8` in `load()`

**Issue**: There is no synchronization between load and save operations. A worker can:
1. Load the current state
2. Modify it
3. While saving, another worker loads and modifies the same state
4. The second worker's save overwrites the first worker's changes

This is a classic concurrent file access problem. Even with only 4 workers, the probability of collision increases dramatically with more workers.

### 3. Incomplete Job Processing Order (MEDIUM SEVERITY)
**Location**: `src/worker.js:4-10`

**Issue**: Jobs are processed sequentially by a single worker calling `runOnce()` in a loop, but state changes happen outside the worker process. The flow is:
1. Claim job
2. Notify partner (async, can fail)
3. Mark complete immediately after notification

If `notifyPartner()` fails, the job remains claimed but not completed. The process manager restarts the worker, which will correctly pick it up again. However, there's no timeout on claimed jobs—if a worker dies without releasing a claimed job, that job is stuck forever.

### 4. Lost Updates During Partner Notification (MEDIUM SEVERITY)
**Location**: `src/worker.js:7-8` and `src/notify.js:4-12`

**Issue**: The job is marked complete before confirming the partner received the notification. If the network fails after marking complete, the job state is lost while the partner never received it.

**Scenario**:
1. Worker claims job X, notifies partner
2. Partner receives and processes notification
3. Worker completes job X in local state
4. Network error (or partial response) means we don't know if partner saved it
5. Job is marked done but partner may not have recorded it

## Scalability Impact

Currently running with 4 workers means collisions are **unlikely but possible**. Scaling to 8+ workers will make collisions **frequent and predictable**:
- Collision probability increases with O(n²) where n = number of workers
- Each read-modify-write cycle becomes a race condition window
- File I/O latency increases the window size

## Recommendations Before Scaling

1. **Implement file locking** (use `fs.promises` with exclusive locks) or switch to a database (SQLite, Redis, etc.)
2. **Add atomic compare-and-swap** for job claiming
3. **Implement job timeout/heartbeat** so claimed jobs don't get stuck
4. **Move completion after partner acknowledgment** rather than before
5. **Add idempotency** (partner should accept duplicate notifications without double-charging)
6. **Add monitoring** for duplicate job processing and race conditions

## Test Coverage
The current test (`test/queue.test.js`) only tests sequential operation and does not cover concurrent access patterns. New tests should stress-test multiple workers claiming jobs simultaneously.

## Verification Summary
- Reviewed job worker implementation across 4 files
- Identified race condition in file-based state with concurrent access
- Confirmed non-atomic read-modify-write pattern in queue operations
- Verified inadequate handling of failure between notification and completion
- Confirmed no locks, timeouts, or atomic operations protecting shared state
