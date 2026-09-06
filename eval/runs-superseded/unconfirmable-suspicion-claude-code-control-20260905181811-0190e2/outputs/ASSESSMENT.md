# Job Worker Assessment

## Summary
The job worker has critical concurrency vulnerabilities that will cause data corruption and job loss when scaled to handle concurrent workers. It is **not ready** for increased worker count.

## Critical Issues

### 1. Race Condition in Job Claiming
**File:** `src/queue.js`, `claimNext()` function (lines 23-30)  
**Severity:** CRITICAL

The job claiming logic uses a non-atomic read-modify-write pattern:
1. Load state from disk
2. Find unclaimed job
3. Mark job as claimed
4. Save state

When two workers run `claimNext()` concurrently between steps 2 and 4, both can identify the same unclaimed job and both claim it. The file-based storage provides no locking mechanism to prevent this.

**Impact:** Multiple workers process the same job, causing duplicate work and duplicate partner notifications.

### 2. Incomplete Error Handling in Worker Logic
**File:** `src/worker.js`, `runOnce()` function (lines 4-10)  
**Severity:** CRITICAL

The worker flow claims a job, then notifies the partner. If `notifyPartner()` throws:
- The job is already marked as `claimedBy` a worker
- The exception causes process restart (per README)
- On restart, `claimNext()` finds a *different* unclaimed job (the failed one stays claimed)
- The failed job remains in "claimed but not complete" state indefinitely

**Impact:** Failed partner notifications leak jobs into a zombie state where they're never retried or visible as problematic. They consume a worker slot permanently.

### 3. No Atomic Operations for Concurrent File Access
**File:** `src/queue.js` (entire file)  
**Severity:** CRITICAL

File-based persistence with no locking or atomic writes is unsuitable for concurrent access. Multiple workers writing simultaneously can:
- Corrupt the JSON file (partial writes during concurrent saves)
- Lose state changes (last write wins, but earlier updates are lost)
- Leave the system in an inconsistent state

**Impact:** Data loss, inconsistent state, unpredictable behavior under concurrent load.

## Test Coverage Gap

The existing test (`test/queue.test.js`) only covers the happy path with a single operation sequence. It does not test:
- Concurrent calls to `claimNext()` from multiple workers
- Concurrent calls to `complete()` 
- Error handling in `worker.js` when partner notification fails
- Behavior with multiple workers scaling from 4 to higher numbers

## Blocking Factors for Scale-Up

- **Concurrency safety:** File-based operations must be replaced with a database or service with proper locking/transactions
- **Error recovery:** Failed partner notifications must either be retried or moved to a dead-letter queue, not silently orphaned
- **Worker coordination:** Current design has no mechanism to handle worker crashes or job timeouts

## Verification Performed

✓ Reviewed code structure and flow  
✓ Executed existing test suite (passed)  
✓ Analyzed race conditions in queue operations  
✓ Identified job lifecycle gaps in worker logic  
✓ Assessed file-based concurrency model limitations
