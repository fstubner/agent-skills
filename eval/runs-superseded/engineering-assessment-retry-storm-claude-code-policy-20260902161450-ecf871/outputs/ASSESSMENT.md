# Payments Worker Audit

## Five Highest-Value Findings

### 1. Infinite Retry Loop Without Timeout (Critical)
**Location:** app/worker.py:9-20

The `charge()` function retries indefinitely with no timeout or maximum retry count. Permanent processor failures (e.g., API shutdown, account suspension) will cause the function to hang forever, exhausting connection pools and worker threads.

**Impact:** A single failed order can block a worker instance indefinitely. At scale, this causes cascading worker hangs and resource exhaustion.

**Recommendation:** Implement a maximum retry count (e.g., 10-15 attempts) or timeout (e.g., 5-10 minutes). Distinguish transient errors (5xx, network timeouts) from permanent ones (4xx status codes should fail immediately).

---

### 2. Silenced Exception Handling Hides Failures (High)
**Location:** app/worker.py:18-19

The bare `except Exception: pass` swallows all errors—network errors, JSON parsing failures, KeyErrors—without logging. This eliminates visibility into what's actually failing in production.

**Impact:** Debugging production issues becomes impossible. Operators can't distinguish between "processor is down" and "malformed order data" or "network partition."

**Recommendation:** Log exceptions with context (order ID, attempt count, error type). Use structured logging for analytics. Consider different handling for different error types.

---

### 3. No Input Validation at Trust Boundary (High)
**Location:** app/worker.py:7, 11-14

The `charge()` function assumes `order` dict contains required keys ("id", "amount_cents", "card_token") without validation. Missing keys raise `KeyError`, caught by the silent exception handler and retried forever.

**Impact:** Invalid orders silently fail indefinitely. Garbage input is indistinguishable from processor failures, blocking legitimate retries and consuming resources.

**Recommendation:** Validate order structure at entry point (`run()` function). Check required fields and data types. Fail fast on invalid input rather than infinite retry.

---

### 4. No HTTP Timeout on External Request (High)
**Location:** app/worker.py:11

`requests.post(PROCESSOR, ...)` has no explicit timeout. Network hangs, incomplete responses, or slow processors will cause the request to hang indefinitely (OS TCP timeout is minutes, not seconds).

**Impact:** Combined with infinite retry loop (Finding 1), a slow or hanging processor can cause permanent worker deadlock.

**Recommendation:** Set explicit timeout (e.g., `requests.post(..., timeout=10)`). Apply per-attempt, not per-retry-sequence.

---

### 5. Unused Security Credential and Undefined Configuration (Medium)
**Location:** app/settings.py:4; app/worker.py:4

`PROCESSOR_KEY` is loaded from environment but never used. The processor endpoint URL is hardcoded. The HTTP request doesn't authenticate with the API key, suggesting incomplete implementation or security misconfiguration.

**Impact:** If the processor API requires authentication, charges may be rejected or unauthorized. If key was meant for security, its absence creates a backdoor.

**Recommendation:** Use `PROCESSOR_KEY` in the HTTP request (header or query parameter). Verify with processor API specification. Alternatively, confirm key is unused and remove it from settings to reduce confusion.

---

## Summary

The worker implements a basic retry pattern but lacks production-grade error handling, input validation, and resource control. The infinite retry loop combined with silent exception handling creates risk of worker deadlock at scale. Critical issues (timeout, retry bounds, input validation) must be addressed before scaling beyond development environments.

## Verification

- Reviewed app/worker.py, app/settings.py, tests/test_worker.py, README.md
- Analyzed retry logic, exception handling, HTTP client configuration, input validation
- Cross-checked against engineering policy baseline (validation at trust boundaries, error handling, test coverage)
- Did not execute code or inspect external systems
