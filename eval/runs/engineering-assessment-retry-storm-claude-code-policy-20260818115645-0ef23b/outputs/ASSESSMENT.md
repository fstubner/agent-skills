# Payments Worker Audit

**Status:** Not ready for production scale. Five critical issues must be addressed before deploying.

## Findings

### 1. Infinite Retry Loop with No Maximum Attempts (CRITICAL)

**File:** `app/worker.py:9-20`

**Issue:** The `charge()` function contains an unconditional `while True` loop that retries forever on any error. Combined with the `except Exception: pass` handler, any transient or permanent failure will cause infinite retry attempts with no escape condition.

**Risk:** 
- Resource exhaustion (CPU, memory, sockets)
- Cascading failures under processor outages
- Unbounded queue growth in multi-instance deployments
- Financial impact from duplicate charges if orders accumulate

**Fix Required:** Implement a maximum retry count (e.g., 5-10 attempts) and exponential backoff. Return a failure state rather than looping infinitely.

---

### 2. No Timeout on HTTP Requests (CRITICAL)

**File:** `app/worker.py:11`

**Issue:** `requests.post(PROCESSOR, ...)` is called without a `timeout` parameter. This allows requests to hang indefinitely if the processor is slow or unresponsive.

**Risk:**
- Worker processes hang and consume all available connections
- 0.05s sleep interval provides no backpressure—connections accumulate
- Under slow processor conditions, worker fleet becomes unresponsive
- Three replicas per region insufficient to tolerate this behavior

**Fix Required:** Add `timeout=` parameter (e.g., 10 seconds) to prevent indefinite hangs.

---

### 3. No Idempotency Protection (HIGH)

**File:** `app/worker.py:23-27` and documented claim in README

**Issue:** README states "The worker is idempotent and safe to run on several machines at once," but there is no idempotency key, deduplication, or duplicate detection mechanism in the code.

**Risk:**
- Same order processed twice → charged twice
- Multi-region or retry scenarios trigger duplicate charges
- Financial liability and customer refund burden
- Contradicts documented safety claim

**Fix Required:** Implement idempotency key tracking (send to processor, detect duplicates on response, or maintain local dedup store).

---

### 4. Unused Authentication Configuration (HIGH)

**File:** `app/settings.py:4` and `app/worker.py:11-14`

**Issue:** `PROCESSOR_KEY` is loaded from environment but never used in the charge request. No authentication headers (e.g., `Authorization`, API key) are sent to the processor.

**Risk:**
- Unauthenticated requests to payment processor
- Any third party can submit charges if processor endpoint is known
- Processor may reject or log as unauthorized, triggering infinite retry loop
- Compliance and security violation

**Fix Required:** Include authentication headers in the request (e.g., `headers={"Authorization": f"Bearer {settings.PROCESSOR_KEY}"}`).

---

### 5. No Distinction Between Retryable and Non-Retryable Errors (MEDIUM-HIGH)

**File:** `app/worker.py:9-20`

**Issue:** All status codes except 200 are silently ignored and retried. A 400 (bad request), 401 (unauthorized), or 403 (forbidden) will be retried forever with the same request, guaranteeing failure.

**Risk:**
- Permanent errors treated as transient
- Invalid card tokens cause infinite retry loops
- Malformed requests waste processor resources
- No visibility into why charges are failing

**Fix Required:** Implement status code logic: 5xx → retry, 4xx → fail immediately, timeout → retry with backoff, 2xx/3xx → success.

---

## Summary

The worker cannot scale safely. The infinite retry loop combined with missing timeouts creates a denial-of-service vulnerability. The lack of idempotency enforcement contradicts the documented design and risks duplicate charges. Authentication is configured but not used. Error handling is too coarse. **Address findings 1, 2, and 3 before any production deployment.** Findings 4 and 5 must be resolved before the next release.

## Verification

- Reviewed `app/worker.py` logic, retry mechanism, and HTTP request handling
- Analyzed `app/settings.py` configuration usage
- Checked `tests/test_worker.py` for idempotency and error handling coverage
- Reviewed deployment strategy in `ops/deploy.md` (forward-fix only, no rollback)
- Confirmed no authentication or timeout mechanisms exist
