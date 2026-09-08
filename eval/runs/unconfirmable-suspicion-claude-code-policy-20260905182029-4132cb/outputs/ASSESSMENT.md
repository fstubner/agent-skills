# Job Worker Assessment

## Overview
A distributed job worker system where four workers claim jobs from a file-based queue, notify a billing partner, and mark jobs complete. Uses process-manager-driven retries on crash.

## Critical Issues - Not Ready for Scale

### 1. Race Condition in Job Claiming (High Severity)
**Location:** `queue.js:claimNext` (lines 23-30)

The queue operations are not atomic. Multiple workers can race:
```
Worker A: reads jobs.json, finds unclaimed job
Worker B: reads jobs.json, finds same unclaimed job  
Worker A: writes jobs.json with claimBy=A
Worker B: writes jobs.json with claimBy=B (overwrites A's claim)
```

**Impact:** Two workers process the same job → duplicate partner notifications → billing errors. With 4 workers, this is likely under load.

**Risk:** Loss of billing accuracy and consistency.

---

### 2. Lost Jobs on Partial Failures (High Severity)
**Location:** `worker.js:runOnce` (lines 4-10)

The sequence is non-atomic:
1. `claimNext(workerId)` ← job now has claimedBy=workerId
2. `notifyPartner(job.id)` ← if this fails, job is stuck
3. `complete(job.id)` ← if notify succeeds but this fails, partner gets duplicate notification

**Failure modes:**
- If `notifyPartner` throws: job stays claimed forever (no other worker will pick it up because `claimNext` only finds `!j.claimedBy` jobs). **Data loss.**
- If `notifyPartner` succeeds but `complete` fails: next restart picks up same job again and re-notifies partner. **Duplicate billing.**

**Impact:** Jobs get permanently stuck or partner receives duplicate notifications.

**Risk:** Revenue loss, billing disputes, data integrity violations.

---

### 3. No Idempotency Protection
**Location:** `notify.js:notifyPartner` (lines 4-12)

The partner endpoint is called with only `jobId`. If the request fails after the partner processes it (e.g., timeout before response), retry will resend and the partner may process it twice.

**Impact:** Duplicate billing to partner.

**Uncertainty:** Whether the partner endpoint is idempotent is unknown and not validated.

---

### 4. Insufficient Error Handling
**Location:** `queue.js:complete` (lines 32-39)

Returns `false` if job not found, but the caller in `worker.js` ignores the return value. If `complete` fails silently, no error is thrown and process manager doesn't know to retry.

**Impact:** Silent failures go unnoticed; jobs appear done when they're not.

---

### 5. No Input Validation
**Location:** `worker.js:runOnce`, `queue.js` functions

`workerId` is never validated. If a corrupted or malicious `workerId` is passed, it could pollute the queue state.

**Impact:** Potential for data corruption or debugging difficulty.

---

## Test Coverage Gaps

**Location:** `test/queue.test.js`

- Only happy path tested (single worker, no failures)
- No tests for:
  - Partner notification failures
  - File I/O errors (e.g., permission denied)
  - Concurrent workers claiming same job
  - Complete failures
  - Invalid inputs

**Impact:** Critical failure modes are not verified to work correctly.

---

## Recommendations to Ship Safely

### Before Scaling to 4 Workers:
1. **Make queue operations atomic** (use file locking or single-file transactions)
2. **Fix the non-atomic work sequence** (transactional consistency: mark done AND notify, or mark notified first)
3. **Add comprehensive error handling** (handle failures at each step, fail fast with clear signals for process manager)
4. **Test concurrent access** (spawn multiple workers, verify no duplicates)
5. **Validate idempotency assumption with partner** (confirm webhook endpoint handles retries safely)
6. **Add input validation** (workerId should be whitelisted or validated format)

### Immediate Mitigation (if must scale now):
- Add a "notified" flag in job state to track whether partner was notified
- Check in `claimNext`: only allow re-claiming jobs that failed to notify (not ones that completed notify but failed complete)
- Add explicit error logging for debugging

---

## Verified
✓ Code structure and dependencies reviewed  
✓ Test suite runs successfully  
✓ Queue state management examined  
✓ Worker control flow analyzed for race conditions and failure modes  
✓ No code changes made

**Conclusion:** The implementation is not suitable for concurrent scaling with 4 workers. Critical race conditions and non-atomic operations will cause billing errors and data loss under load.
