# Payments Worker Security & Reliability Audit

## Summary
The payments worker contains five critical issues that will cause resource exhaustion, authentication failure, and unobservable failures when scaled. These must be resolved before production deployment.

---

## Finding 1: Infinite Retry Loop Without Upper Bound (Resource Exhaustion)

**Location:** `app/worker.py:9-20`

**Severity:** Critical

**Issue:** The `charge()` function loops indefinitely with no maximum retry count or timeout. If the payment processor becomes unavailable or unresponsive, this will:
- Exhaust memory and CPU resources on each worker instance
- Accumulate unbounded threads/connections waiting for responses
- Never fail or alert, causing silent cascade failures when scaled to multiple machines

**Impact at Scale:** At BATCH_SIZE=500 (settings.py), a single failed processor outage will spawn 500+ hung workers consuming resources indefinitely.

---

## Finding 2: Missing Authentication (PROCESSOR_KEY Unused)

**Location:** `app/worker.py:11-15` and `app/settings.py:4`

**Severity:** Critical

**Issue:** The payment processor API endpoint is called without the `PROCESSOR_KEY` that is configured in settings. The code makes unauthenticated requests:
```python
response = requests.post(PROCESSOR, json={...})  # No auth headers
```

The configured `PROCESSOR_KEY` is never used. This creates a security violation—payment processing requires authentication.

**Impact at Scale:** Unauthenticated requests will be rejected by the real payment processor, causing all charges to fail and retry infinitely (compounding Finding 1).

---

## Finding 3: No Timeout on Network Requests (Connection Exhaustion)

**Location:** `app/worker.py:11`

**Severity:** Critical

**Issue:** The `requests.post()` call has no timeout parameter:
```python
response = requests.post(PROCESSOR, json={...})  # No timeout
```

If the payment processor hangs or becomes slow to respond, this will block indefinitely, consuming connection pool resources.

**Impact at Scale:** At 500+ concurrent workers, unresponsive requests will exhaust the connection pool, making it impossible to process new orders or even communicate with other services.

---

## Finding 4: Silent Exception Swallowing With No Observability

**Location:** `app/worker.py:18-19`

**Severity:** High

**Issue:** All exceptions are caught and silently ignored:
```python
except Exception:
    pass
```

This catches:
- Network timeouts and connection errors
- Invalid JSON responses
- Any processor errors

With no logging, monitoring, or alerting, failures are completely invisible in production. Operators won't know charges are failing until customers report missing transactions.

**Impact at Scale:** At high throughput, you'll have no visibility into failure modes, making incident response impossible.

---

## Finding 5: Incorrect Retry Logic for Different Error Types

**Location:** `app/worker.py:16-20`

**Severity:** High

**Issue:** The code only succeeds on HTTP 200 and retries on all other outcomes, but HTTP status codes indicate different problems:

- **200:** Success ✓
- **4xx (400, 401, 403, 404):** Client errors (invalid request, auth failure, not found) → should fail immediately, not retry forever
- **5xx (500, 503):** Server errors (transient) → appropriate to retry
- **Connection errors:** Transient network issues → appropriate to retry

Retrying indefinitely on 4xx errors (especially 401/403 from missing auth) will hang forever. There's no logic to distinguish transient from permanent failures.

**Impact at Scale:** Invalid requests or authentication failures will retry infinitely instead of failing fast, tying up resources and delaying error discovery.

---

## Verification Notes

- README claims the worker is "idempotent and safe to run on several machines at once," but no idempotency mechanism (deduplication, request IDs, or transactional safety) is present in the code.
- Settings define `DATABASE_URL` and `PROCESSOR_KEY` but only `PROCESSOR_KEY` is unused by the worker; no database operations occur.
- Test coverage is minimal—only module import and batch size validation; no tests for the actual charge retry logic.

---

## Recommendation

Do not scale this worker without addressing all five findings. Priority order:
1. Add authentication (use PROCESSOR_KEY)
2. Add timeout to requests
3. Replace infinite loop with bounded retries + exponential backoff
4. Add structured logging for all outcomes
5. Implement HTTP status code-aware retry logic
