# Job Worker Assessment

## Summary
The job worker implementation has a functional single-worker design but contains **critical concurrency bugs** and missing error handling that make it unsuitable for the stated production requirement of 4 concurrent workers. The main blocker is file-based state management without atomic operations or locking, combined with a race condition in the core work loop.

## Architecture
The system has three layers:
- **worker.js**: Orchestrates the claim → notify → complete sequence
- **queue.js**: File-based job queue using JSON persistence
- **notify.js**: Sends webhook notifications to a billing partner

## Critical Issues (Block Scaling)

### 1. Race Condition in Work Sequence (worker.js:4-9)
**Severity: HIGH - Data Loss**

The claim-notify-complete sequence has no transaction safety:
```javascript
const job = claimNext(workerId);              // claims job
await notifyPartner(job.id);                  // if this fails...
complete(job.id);                             // ...we still mark it done
```

If `notifyPartner` fails (network error, partner timeout, 5xx response), the job is already marked complete and will never retry. The worker then restarts but finds no work to do—the job is lost.

**Impact with 4 workers:** If the partner webhook experiences transient failures (common in production), jobs will silently drop. Billing partner gets no notification for completed work.

### 2. Concurrent Access to Shared JSON File (queue.js:1-40)
**Severity: HIGH - Data Corruption**

All four workers read and write to the same `.data/jobs.json` file with no locking mechanism. The sequence in `claimNext` and `complete` is not atomic:

```javascript
function claimNext(workerId) {
  const state = load();           // Worker A reads state at 10:00:00
  const job = state.jobs.find(j => !j.claimedBy && !j.done);
  if (!job) return null;
  job.claimedBy = workerId;       // Worker B loads same state, modifies same job at 10:00:00.001
  save(state);                    // Worker A writes, overwriting Worker B's claim
  return job;
}
```

Possible failure modes:
- Two workers claim the same job
- Claims are lost when overlapping writes occur
- File corruption from concurrent writes
- JSON parse errors if a write is interrupted

**Impact with 4 workers:** Jobs get claimed by multiple workers, duplicating work and causing billing overcharges.

### 3. Missing Error Handling in notify.js
**Severity: MEDIUM - Unreliability**

No retry logic, timeout, or fallback strategy:
- If `fetch` hangs, the worker hangs indefinitely (no timeout set)
- If partner returns 5xx or network fails, work is lost (tied to issue #1)
- No circuit breaker or backoff for cascading failures

The code assumes the webhook always succeeds within a reasonable time.

### 4. Missing Input Validation (All modules)
**Severity: MEDIUM - Security/Robustness**

- `notifyPartner` doesn't validate `jobId` before sending
- `claimNext` doesn't validate `workerId`
- `enqueue` doesn't validate the job object shape
- `complete` accepts any string ID without checking the job exists (returns false silently)
- `PARTNER_WEBHOOK` env var not validated at startup

If a malformed jobId is passed, it gets sent to the billing partner as-is.

### 5. ID Generation Flaw (queue.js:17)
**Severity: LOW - Potential Duplicates**

```javascript
id: `j${state.jobs.length + 1}`
```

Using array length + 1 for IDs means:
- If jobs are ever deleted or filtered, IDs will duplicate
- Example: 5 jobs exist (j1-j5), delete j3, add new job → ID is j6, not j4 (OK), but after 10k deletions and additions, ID will cycle and duplicate

Current test data is immutable, so this doesn't manifest yet.

### 6. No Authentication on Webhook (notify.js:5-9)
**Severity: MEDIUM - Security**

The webhook URL is sent in plaintext with no auth headers. Partner endpoint is unauthenticated—any service that knows the URL can spam it with fake job completions.

## Test Coverage

Single test case in `test/queue.test.js` only covers the happy path (enqueue → claim → complete) with no:
- Concurrent claim attempts
- Failure scenarios (notify fails, missing env vars)
- Invalid inputs
- Persistence across restarts

## Suitability for 4 Concurrent Workers

**NOT READY.** The implementation is suitable for:
- Single worker / single-threaded scenarios ✓
- Light prototype/POC ✓

It is NOT suitable for:
- Multiple concurrent workers ✗ (no concurrency control)
- Production with network failures ✗ (no retry/rollback)
- Data consistency requirements ✗ (race conditions)

## Recommendations

To scale to 4 workers safely:

1. **Implement atomic operations** (HIGH PRIORITY):
   - Use a database with transactions instead of JSON files, OR
   - Add file-level locking with flock/fcntl, OR
   - Redesign to claim jobs atomically (e.g., move claimed job to separate file)

2. **Fix the work sequence** (HIGH PRIORITY):
   - Mark job complete ONLY after successful partner notification
   - Add rollback: if notify fails, unclaim the job for retry
   - Set a timeout on `fetch()` (e.g., 30s)

3. **Add input validation**:
   - Validate PARTNER_WEBHOOK at startup
   - Validate job structure in `enqueue`
   - Validate workerId and jobId

4. **Add resilience**:
   - Implement exponential backoff for failed notifications
   - Add circuit breaker if partner is down
   - Add structured logging to detect silent failures

5. **Expand test coverage**:
   - Test concurrent worker scenarios with multiple `claimNext` calls
   - Test notifyPartner failure and recovery
   - Test missing/invalid env vars

## Remaining Unknowns

- Process manager retry behavior on uncaught exceptions vs. implicit restarts
- Whether jobs are ever deleted or only appended
- Partner webhook retry expectations (does it expect idempotency?)
- Expected scale (requests/second, job volume)

Without clarification on these, the recommendation is to not scale beyond 1 worker until concurrency control is implemented.
