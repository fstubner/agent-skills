# Job Worker Assessment

## Summary
The current job worker implementation has critical race conditions that make it unsafe for scaling beyond a small number of workers. It is **not ready** for increased worker count without architectural changes.

## Critical Issues

### 1. Race Condition in Job Claiming (claimNext)
**Severity: CRITICAL**

The `claimNext()` function uses a read-then-write pattern without concurrency control:
```
1. Load state from disk
2. Find unclaimed job
3. Mark as claimedBy = workerId
4. Save state back to disk
```

With multiple workers running concurrently:
- Worker A reads state (finds Job J unclaimed)
- Worker B reads state (finds Job J unclaimed) 
- Worker A marks Job J as claimedBy='w1' and saves
- Worker B marks Job J as claimedBy='w2' and saves (overwrites Worker A's save)
- Both workers now believe they claimed Job J

**Impact**: Jobs processed by multiple workers simultaneously, causing duplicate billing and duplicate partner notifications.

### 2. Loss of Concurrent Updates
**Severity: CRITICAL**

The file-based queue has no locking mechanism. When multiple workers operate on the same jobs.json file:
- Concurrent reads can load stale state
- Concurrent writes overwrite each other
- Updates from one worker can be lost when another worker saves

**Example scenario**:
- Worker A loads state, claims Job J, saves
- Worker B loads same state, completes Job K, saves
- Worker B's save overwrites Worker A's claim of Job J

### 3. Idempotency Assumption Without Verification
**Severity: HIGH**

The worker sequence is:
1. Claim job
2. Call notifyPartner(jobId)
3. Mark job done

If a worker crashes between step 2 and 3:
- Partner is notified the job is complete
- Job is not marked done in the queue
- Next worker picks it up and calls notifyPartner again
- **Result**: Double billing if partner API is not idempotent

The code does not:
- Document that notifyPartner must be idempotent
- Verify idempotency at startup
- Implement idempotent transaction handling (e.g., marking done before partner notification)

### 4. No Atomic Transactions
**Severity: HIGH**

The three-step workflow (claim → notify → complete) has no transactional guarantees. Multiple failure windows exist:
- After claim but before notify: Worker A claims, Worker B might steal it while A is notifying
- After notify but before complete: Partner is told job is done, but queue doesn't reflect this
- During save operations: State file is never exclusively locked

### 5. Test Coverage Gap
**Severity: MEDIUM**

The test suite only covers the happy path with a single worker. No concurrent scenarios are tested:
- No test for multiple workers claiming the same job
- No test for concurrent claim/complete operations
- No test for partial failure recovery

## Scaling Impact

With current design:
- **4 workers**: Race conditions may occur intermittently
- **8+ workers**: Race conditions become frequent and severe
- **Increasing load**: Contention on jobs.json increases probability of all race conditions

## Recommendations Before Scaling

To safely increase worker count, the system needs:

1. **Add File Locking**: Implement atomic read-modify-write with exclusive locks during state mutations
2. **Redesign Idempotency**: Either:
   - Move job completion marking to occur atomically BEFORE partner notification, OR
   - Implement duplicate detection at partner API level with unique transaction IDs
3. **Add Transactional Semantics**: Use atomic operations or database transactions to ensure claim+complete are not separately observable
4. **Enhance Monitoring**: Add metrics for concurrent claim attempts and recovery scenarios
5. **Expand Testing**: Add concurrent worker simulation tests to catch race conditions before production

## Current Capabilities

✓ Single worker deployment works correctly  
✓ Basic happy path is functional  
✓ Partner notification mechanism is in place

## Blockers for Scaling

✗ No concurrency control (file locking)  
✗ No transactional guarantees  
✗ Idempotency assumptions undocumented  
✗ No concurrent scenario testing  
✗ Risk of duplicate processing and double billing
