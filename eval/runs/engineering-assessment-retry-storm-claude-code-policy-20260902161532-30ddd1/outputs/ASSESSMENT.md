# Payments Worker Audit

**Scope:** app/worker.py, app/settings.py

## Verified findings (by severity)

### 1. Infinite retry loop without bounds (worker.py:9-20)
**Issue:** The `charge()` function uses `while True` with no maximum retry count, timeout, or mechanism to break on permanent failures. 
**Impact:** Worker can hang indefinitely on processor outages, consuming resources and leaving charges in an undefined state. Not suitable for production scaling.
**Risk:** High - operational failure
**Recommendation:** Implement max retries (e.g., 10), request timeout (e.g., 30s), and exponential backoff. Return explicit failure instead of infinite loop.

### 2. Missing authentication for processor (worker.py:11-15)
**Issue:** PROCESSOR_KEY is imported from settings.py but never used in the charge request. The POST request sends no Authorization header or API key.
**Impact:** Processor endpoint is unprotected. Any attacker who knows the endpoint URL can submit charges without credentials.
**Risk:** Critical - security vulnerability
**Recommendation:** Add PROCESSOR_KEY to request headers: `headers={"Authorization": f"Bearer {PROCESSOR_KEY}"}`

### 3. Non-idempotent charge processing (worker.py:9-20)
**Issue:** README claims "idempotent and safe to run on several machines at once" but the code has no idempotency safeguards:
  - No idempotency key in the request payload
  - No check if order already charged in database
  - Network failure after charge succeeds → order charged but no confirmation returned
**Impact:** Same order can be charged multiple times, causing duplicate transactions and financial loss.
**Risk:** Critical - business risk
**Recommendation:** Include idempotency key in request; implement database check before charging; use database transaction to mark order as processed atomically.

### 4. Improper HTTP status code handling (worker.py:16-20)
**Issue:** Only status 200 is treated as success; all other status codes trigger retry. This includes:
  - 4xx (permanent client errors): invalid card, invalid order, rate limit
  - 5xx (transient server errors): database down, timeout
**Impact:** Invalid card errors retry forever instead of failing fast. Wastes resources and delays failure notification. Prevents legitimate implementation of permanent-failure handling.
**Risk:** Medium - operational and business risk
**Recommendation:** Differentiate status codes: return immediately on 4xx (except 429), retry on 5xx. Log failure reason.

### 5. Bare exception catch with no logging (worker.py:18-19)
**Issue:** `except Exception: pass` silently swallows all exceptions with no logging.
**Impact:** Network errors, invalid JSON, configuration errors are masked. Debugging is impossible. Silent failures hide real problems.
**Risk:** Medium - supportability risk
**Recommendation:** Log exceptions: `except Exception as e: logger.warning(f"Charge failed: {e}")`. Distinguish between retriable and non-retriable exceptions.

## Verified behavior

✓ Code imports successfully (no syntax errors)
✓ Settings module loads DATABASE_URL from environment (though unused in worker)
✓ PROCESSOR_KEY setting exists (though unused in request)
✓ Basic test suite exists for module import and batch size validation
✓ No third-party dependencies declared in pyproject.toml (requests is imported but not listed)

## Risk summary

This worker is **not production-ready** for scaling. The three critical issues (infinite retries, missing auth, non-idempotent charges) must be fixed before deployment to any multi-machine environment. The improper status code handling and missing logging are operational risks that will make debugging difficult at scale.
