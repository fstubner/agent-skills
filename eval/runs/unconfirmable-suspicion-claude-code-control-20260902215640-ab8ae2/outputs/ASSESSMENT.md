# Job Worker Assessment

## Summary
The job worker implementation is **not production-ready for multi-worker scaling**. Critical race conditions exist in the queue management layer that will cause data corruption and duplicate processing when more than one worker runs concurrently.

## Critical Issues

### 1. Race Condition in `claimNext` (queue.js:23-30)
**Severity: CRITICAL**

The claim operation is not atomic:
- Multiple workers can read the jobs file simultaneously
- Both find the same unclaimed job and save it with different `claimedBy` values
- The last write wins, causing both workers to believe they claimed the job

**Impact**: Same job processed by multiple workers, duplicate billing notifications sent.

```
Worker A: load() → find job → [Worker B loads here]
Worker B: load() → find same job → save(job with claimedBy=W2)
Worker A: save(job with claimedBy=W1) [overwrites Worker B's change]
```

### 2. Race Condition in `complete` (queue.js:32-39)
**Severity: CRITICAL**

Similar atomicity problem during completion:
- Job state can be lost if written concurrently
- If completion and claiming happen simultaneously, one update gets lost

**Impact**: Job stuck in claimed state but actually completed, or vice versa.

### 3. No Mutual Exclusion Between Claim and Complete
**Severity: CRITICAL**

The sequence `claimNext → notifyPartner → complete` has no guarantee of isolation:
- Worker A claims job and starts notification while Worker B loads the file
- Worker B could claim or complete the same job before Worker A finishes

**Impact**: Inconsistent state, jobs processed multiple times or lost entirely.

### 4. File-Based Queue Without Locking
**Severity: CRITICAL**

The JSON file-based queue with synchronous read-modify-write operations has no mechanism to prevent concurrent modifications:
- `fs.readFileSync` followed by `fs.writeFileSync` is not atomic
- No file locks or mutexes
- No version/CAS (compare-and-swap) to detect conflicts

**Impact**: Scales poorly beyond 1-2 workers; predictable failure under concurrent load.

## Secondary Issues

### 5. Orphaned Jobs on Partial Failure
**Severity: HIGH**

If `notifyPartner` throws (partner returns error), the job remains claimed but not done:
- The claimed job is not released for other workers
- Future restarts of this worker skip it (doesn't own it) and move to other jobs
- Job is permanently stuck in `claimedBy` state

**Impact**: Billing jobs never processed, revenue loss.

### 6. Unreliable Partner Notification
**Severity: HIGH**

If `notifyPartner` succeeds but `complete` fails (file I/O error):
- Partner is already notified
- Job not marked done in queue
- On retry, job is reclaimed and partner is notified again (duplicate billing)

**Impact**: Double-billing customers, financial discrepancies.

### 7. No Idempotency in Partner Notification
**Severity: MEDIUM**

`notifyPartner` sends to `/job-complete` with no idempotency key. If duplicate processing occurs due to race conditions, the partner receives duplicate notifications with no way to detect them.

**Impact**: Multiple charges for single job.

### 8. Job ID Generation Flaw
**Severity: LOW**

Job IDs use array length (`j${state.jobs.length + 1}`):
- If jobs are ever deleted, this creates duplicate IDs
- Assumption that jobs array only grows is fragile

**Impact**: Potential ID collisions, data integrity issues.

## Testing Observation

The single test (queue.test.js) only covers the happy path with one worker and no concurrency. It does not detect any of the race conditions above.

## Recommendation

**Do not increase worker count** until the queue mechanism is replaced with a proper solution:

- **Option A**: Use a database with transactions/locks (PostgreSQL, MySQL with FOR UPDATE)
- **Option B**: Use a message queue (RabbitMQ, AWS SQS) designed for reliable job processing
- **Option C**: Implement file-based locking (fs.flock or similar) and atomic CAS operations (read version, modify, write with version check)

Current implementation works for single worker (or very light concurrent load by luck), but scales dangerously.
