# Payments Worker Audit

## Executive Summary

The payments worker has five critical issues that prevent safe production operation. The most severe are: missing API authentication, infinite retry loop without resource bounds, and silent error swallowing that masks failures. The code also lacks idempotency protection despite running three replicas, creating double-charge risk.

---

## Findings (Highest-Value First)

### 1. Missing API Authentication
**Severity:** Critical — Auth will fail, no charges process

The worker defines `PROCESSOR_KEY` in settings but never uses it. The charge request sends no authorization header:

```python
response = requests.post(PROCESSOR, json={...})
```

The processor at `https://cards.example.com/v1/charge` will reject all requests. Every charge silently retries forever. **Impact:** Zero revenue. 

**Fix:** Add the API key to request headers: `headers={"Authorization": f"Bearer {PROCESSOR_KEY}"}`


### 2. Infinite Retry Loop Without Bounds
**Severity:** Critical — Resource exhaustion under processor outage

The `charge()` function loops forever with no max retries, no circuit breaker, and fixed 50ms sleep:

```python
while True:
    try:
        ...
    except Exception:
        pass
    time.sleep(0.05)
```

If the processor goes down for 10 minutes, the worker spins indefinitely, consuming CPU and memory across all three replicas. No exponential backoff to back off load. **Impact:** Cascading resource failure during outages.

**Fix:** Add max retries (e.g., 60) and exponential backoff (e.g., `time.sleep(2 ** min(attempt, 5))`).


### 3. Silent Exception Swallowing
**Severity:** High — Hidden failures, no observability

All exceptions (network timeout, DNS failure, invalid JSON response, etc.) are caught and silently retried:

```python
except Exception:
    pass
```

Only 200 status codes succeed; 400s, 500s, and timeouts are also silently retried without logging or alerting. This masks configuration errors, processor bugs, and transient failures that warrant investigation. **Impact:** Invisible failures and cascading issues.

**Fix:** Log exceptions with order ID. Differentiate transient errors (5xx, timeouts) from permanent ones (4xx auth/validation). Emit metrics or alerts on repeated failures.


### 4. No Idempotency Protection Against Duplicate Charges
**Severity:** High — Double-charge risk with three replicas

README states "The worker is idempotent," but the code has no idempotency mechanism. With three replicas processing the same orders queue concurrently:

1. Replica A charges order #123, receives response but network drops it
2. Replica B independently charges order #123, succeeds  
3. Replica A retries order #123, succeeds again
4. Result: Customer charged twice

**Impact:** Revenue loss via refunds, churn, compliance issues.

**Fix:** Require the processor to track idempotency keys (unique `idempotency_key` per order in the request). Check response for duplicate-charge error (e.g., 409 Conflict). Use database or deduplication to mark orders as already processed before calling the processor.


### 5. No Input Validation at Trust Boundary
**Severity:** Medium — Invalid data passed to processor

The function accepts any order structure without validation:

```python
def charge(order):
    ...
    "amount_cents": order["amount_cents"],
    "card_token": order["card_token"],
```

Orders missing fields, with invalid amounts (negative, zero, too large), or malformed card tokens are passed to the processor. The processor may reject them with errors that are silently retried. **Impact:** Silent failures, processor abuse, invalid charges.

**Fix:** Validate at the entry point (`run()`): check `amount_cents > 0`, `card_token` is non-empty, `order_id` exists.

---

## Additional Observations

- **Unused settings:** `BATCH_SIZE` is defined but never used; `DATABASE_URL` is required but the worker doesn't connect to a database.
- **Test coverage:** Only two trivial tests (module import, settings positive). No business logic tests, no retry path verification despite README claiming pytest covers it.
- **Missing timeout:** `requests.post()` has no timeout; requests can hang indefinitely, exacerbating resource exhaustion under processor hangs.
- **No metrics:** No instrumentation to track charge success rate, retry count distribution, or latency. Critical for monitoring at scale.

---

## Verification

✓ Reviewed worker.py charge and run functions  
✓ Verified PROCESSOR_KEY is defined but unused in requests  
✓ Confirmed infinite loop has no max retries or backoff  
✓ Checked exception handling—all errors silently retried  
✓ Examined test coverage—insufficient for production claims  
✓ Validated deploy architecture—three replicas with no idempotency marker  

**Recommendation:** Do not scale up. Fix findings 1–2 (auth and retry bounds) before any production traffic. Address findings 3–5 before multi-replica deployment.
