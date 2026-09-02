# Payments Worker Audit Assessment

## Summary
The payments worker has five critical issues that make it unsafe to scale. The most severe problems involve infinite retry loops, hidden failures, and potential duplicate charges.

---

## Finding 1: Infinite Retry Loop Without Bounds (CRITICAL)

**Location:** `app/worker.py:9-20`

**Issue:** The `charge()` function uses `while True` with no maximum retry count, timeout, or exit condition. If the payment processor is unavailable or experiencing outages, this function will retry forever, consuming resources indefinitely.

**Impact at Scale:**
- Workers hang indefinitely during processor outages
- Memory exhaustion from accumulated hanging requests
- No visibility into payment failures
- Cascading resource depletion across all regions
- Deployment described in `ops/deploy.md` uses 3 replicas per region; a single processor outage will hang all of them

**Recommendation:** Implement a maximum retry count (e.g., 10-15 retries), cumulative timeout (e.g., 5 minutes), and explicit exit with error logging.

---

## Finding 2: Silent Exception Handling Masks Failures (CRITICAL)

**Location:** `app/worker.py:18-19`

**Issue:** The bare `except Exception: pass` silently catches and ignores all exceptions, including network timeouts, connection errors, and JSON parsing errors. This prevents:
- Visibility into what actually failed
- Distinguishing transient from permanent failures
- Proper monitoring and alerting
- Root cause analysis during outages

**Impact:** When scaling, silent failures will make the system appear to work while actually dropping or retrying charges indefinitely. Debugging payment issues becomes impossible.

**Recommendation:** Log exceptions with context (order ID, error type, attempt count) and implement specific exception handling for different failure modes.

---

## Finding 3: No Timeout on HTTP Requests (HIGH)

**Location:** `app/worker.py:11`

**Issue:** `requests.post(PROCESSOR, ...)` has no `timeout` parameter. If the processor endpoint hangs or responds very slowly, requests will block indefinitely.

**Impact at Scale:**
- Hanging requests consume Python threads/connections indefinitely
- Connection pool exhaustion prevents other requests
- Cascading failures where slow processor responses block all charging
- Workers become unresponsive to new orders
- With "three replicas run in every region," this will cascade across infrastructure

**Recommendation:** Add `timeout=30` (or appropriate value for your SLA) to the `requests.post()` call.

---

## Finding 4: Duplicate Charges Risk Due to Missing Idempotency (HIGH)

**Location:** `app/worker.py:7-26`

**Issue:** README states "The worker is idempotent" but the implementation has no idempotency guarantees:
- No idempotency key sent to processor
- Retries send identical requests with no deduplication
- No tracking of which orders were successfully charged
- If a request succeeds but the response is lost, a retry will charge again

**Impact:** For a payment system, duplicate charges are severe: they violate SLAs, create customer disputes, and generate chargebacks. At scale with multiple replicas, this risk is magnified.

**Recommendation:** Implement idempotency by:
- Generating and sending an idempotency key (derived from order ID)
- Having the processor reject duplicate idempotency keys
- Tracking successful charges to prevent local retries on success

---

## Finding 5: Sensitive Card Token Exposure (MEDIUM)

**Location:** `app/worker.py:14`

**Issue:** The `card_token` is passed in the request JSON body. It could be:
- Logged by the `requests` library or any middleware
- Stored in request/response logs by monitoring systems
- Exposed via error messages or stack traces
- Captured in network packet inspection

This creates a PCI-DSS compliance violation and security liability.

**Impact:** Credential exposure, compliance violation, potential breach of cardholder data.

**Recommendation:** 
- Never log card tokens
- Pass only tokenized references to the processor
- If tokens must be sent, use secure headers and configure logging to exclude sensitive fields
- Review what the processor expects and whether tokens should be sent at all

---

## Secondary Issues (Not in Top 5)

- **Aggressive retry interval:** Fixed 50ms sleep will hammer the processor during outages
- **No HTTP status differentiation:** Treats 4xx errors (invalid card) the same as 5xx (server error), both causing infinite retries
- **Unused configuration:** `PROCESSOR_KEY` in settings is never used; incomplete implementation
- **No monitoring hooks:** No way to observe retry counts, failures, or payment outcomes

---

## Verification Notes

This assessment was conducted through:
1. Code review of `app/worker.py`, `app/settings.py`, `README.md`, and `ops/deploy.md`
2. Analysis of deployment context (multi-region, no rollback)
3. Evaluation against payment system reliability requirements
4. Assessment of behavior during processor outages and network issues

The worker cannot safely scale to multi-region deployment without addressing findings 1-3.
