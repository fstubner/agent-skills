# Worker Assessment

## Summary
The current worker implementation has fundamental concurrency issues that **prevent safe scaling** beyond the current 4-worker setup. All issues are structural and require redesign, not fixes.

## Critical Issues

### 1. Race Condition in Job Claiming
**Severity**: Critical | **Blocks scaling**

`claimNext()` reads the state, locates an unclaimed job, marks it claimed, and saves. But between `load()` and `save()`, another worker can claim the same job.

**Scenario**: Workers w1 and w2 both call `claimNext()` simultaneously. Both read the same state with job J unclaimed. Both mark J as claimed and save. Only w2's save persists (overwrites w1's). Both workers now hold J and will process it twice.

**Impact**: Jobs processed multiple times; duplicate billing charges; data inconsistency.

### 2. Dead Jobs on Notification Failure
**Severity**: Critical | **Data loss**

The worker claims the job, then calls the async `notifyPartner()`. If this throws (network timeout, partner returns 5xx, etc.), the job remains claimed but is never marked done. On restart, `claimNext()` skips claimed jobs, so this job becomes stuck indefinitely.

**Scenario**: Worker claims job J, notification fails mid-call. Worker crashes (per README, retries via process manager). On restart, `claimNext()` skips J because `claimedBy` is set. J never retries unless manually cleared from storage.

**Impact**: Jobs silently lost; stuck in claimed state; no error signal.

### 3. File Contention Under Load
**Severity**: High | **Degrades with scale**

Each claim and complete operation reads and rewrites the entire jobs.json file. With 4 workers, this is already O(n²) contention. Increasing workers multiplies write conflicts and slowdowns.

**Impact**: Higher latency per operation; failed writes from simultaneous saves; increased crash risk from file lock timeouts.

### 4. No Transaction Atomicity
**Severity**: High | **Data corruption risk**

The fs.writeFileSync is not atomic. If the process crashes or the system fails mid-write, the JSON file can be corrupted (partial writes, invalid JSON).

**Impact**: Unrecoverable data loss; cluster unable to restart if data file is malformed.

### 5. Weak State Ownership
**Severity**: Medium

`complete(id)` doesn't verify that the calling worker claimed the job. Any worker can mark any job done.

**Impact**: If a bug causes a worker to call `complete()` on the wrong job, that job is lost without validation.

## Conclusion
**Do not increase worker count.** The file-based locking model cannot safely handle concurrent writes. Scaling requires:
- Replace file-based storage with a proper database or distributed queue (Redis, RabbitMQ, etc.)
- Implement atomic operations for claim + save
- Add failure recovery (dead-letter queue for jobs that fail notification repeatedly)
- Add job ownership tracking and validation
