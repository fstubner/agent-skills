# Payments Worker Audit

## Summary
The payments worker has five critical issues that pose significant risk when scaling across multiple regions with multiple replicas. These issues could cause resource exhaustion, undiagnosable production incidents, duplicate charges, and worker hangs.

## Critical Findings

### 1. Infinite Retry Loop Without Timeout (worker.py:9-20)
**Risk:** CRITICAL - Resource Exhaustion

The `charge()` function contains an unconditional `while True` loop with no timeout, max retries, or circuit breaker. If the payment processor becomes unreachable, the worker thread will retry indefinitely, blocking processing of subsequent orders and exhausting worker thread pools across all replicas.

**Impact at scale:** Multiple replicas across multiple regions all retrying indefinitely could cause cascading failures and complete blocking of payment processing.

**Mitigation:** Implement maximum retry count (e.g., 5-10 retries) and exponential backoff with upper limit, or add timeout threshold (e.g., 5-10 minutes) before giving up.

---

### 2. Blind Exception Handling (worker.py:18-19)
**Risk:** CRITICAL - Undiagnosable Incidents

The bare `except Exception: pass` silently swallows all exceptions without any logging. Network timeouts, SSL errors, JSON decode failures, and connectivity issues are completely invisible. This prevents any operational visibility into what's failing in production.

**Impact at scale:** When incidents occur across dozens of replicas, operators have zero insight into root causes, making MTTR unacceptably high.

**Mitigation:** Log all exceptions with context (order ID, error type, attempt count). Use structured logging for production debugging.

---

### 3. No Request Timeout (worker.py:11)
**Risk:** CRITICAL - Thread Exhaustion

`requests.post()` is called without a timeout parameter. If the payment processor is slow or hangs, the request will wait indefinitely, blocking that worker thread. With multiple replicas and short retry sleep (50ms), thread pools could be exhausted, freezing order processing.

**Impact at scale:** A single slow endpoint could hang dozens of worker threads across all replicas simultaneously.

**Mitigation:** Set a reasonable timeout (e.g., 10-30 seconds) on the requests.post() call.

---

### 4. Indiscriminate Retry on All HTTP Status Codes (worker.py:16-17)
**Risk:** HIGH - Wasted Retries and Permanent Failures Masked

The code checks only `if response.status_code == 200` and retries on everything else. This means:
- 400/401/403 (client errors) are retried forever—they will never succeed
- 422 (unprocessable entity) from invalid card data is retried—wastes resources
- 5xx (server errors) are retried—correct, but indiscriminately grouped with above

Failed charges are never surfaced to calling code; `charge()` can hang indefinitely on invalid requests.

**Impact at scale:** Invalid orders or permission errors cause permanent hangs per replica, with no way to distinguish from transient network issues.

**Mitigation:** Differentiate: retry only on 5xx, 429 (rate limit), and network timeouts. Return error responses for 4xx. Set explicit timeout on retries.

---

### 5. Idempotency Not Enforced Despite Multi-Replica Deployment (README.md, worker.py)
**Risk:** HIGH - Duplicate Charges

README claims the worker is "idempotent and safe to run on several machines at once," but the code contains no deduplication mechanism:
- No request ID/idempotency key sent to processor
- No database deduplication check before charging
- No locking or transaction coordination

With three replicas in every region, a network partition or race condition during order handoff could result in the same order being charged multiple times.

**Impact at scale:** Horizontal scaling increases probability of processing the same order on multiple replicas, directly causing customer overcharges.

**Mitigation:** Add idempotency key to processor requests (tied to order ID), or implement database-level uniqueness constraints with transaction handling.

---

## Verification Performed
- Reviewed core worker logic (charge and run functions)
- Analyzed exception handling and retry mechanisms
- Examined HTTP status code handling
- Verified configuration loading and settings usage
- Checked for idempotency mechanisms
