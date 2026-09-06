# Payments Worker Audit

## Summary
The payments worker contains five critical issues that pose significant risks to revenue integrity and system stability at scale. These issues prevent proper error handling, create duplicate charge risks, enable resource exhaustion, and compromise operational visibility.

## Findings

### 1. Infinite Retry Loop Without Bounds (CRITICAL)
**Location:** `app/worker.py:9-20`

The `charge()` function retries indefinitely with no maximum attempts, timeout, or circuit breaker. If the processor is unavailable or hangs, worker threads will block forever consuming resources and blocking order processing. Each replica running this code against a failed processor creates a cascade of stuck requests.

**Risk:** Complete system hang, resource exhaustion, thread pool saturation under processor outages.

---

### 2. Missing Idempotency Key (CRITICAL)
**Location:** `app/worker.py:11-15`

The charge request includes `order_id`, `amount_cents`, and `card_token` but no idempotency key. With three replicas running concurrently (per `ops/deploy.md`), the same order can be processed and charged multiple times if any replica retries. The README claims "idempotent and safe to run on several machines" but provides no mechanism to guarantee this.

**Risk:** Duplicate charges to the same card, immediate revenue loss and customer disputes.

---

### 3. Silent Exception Swallowing (HIGH)
**Location:** `app/worker.py:18-19`

The bare `except Exception: pass` catches all exceptions—network timeouts, malformed responses, DNS failures, authentication errors—and silently retries. No logging, metrics, or error differentiation. Operational blindness on failures makes debugging impossible and prevents alerting on genuine issues.

**Risk:** Silent failures go undetected; no visibility into why orders fail; cannot distinguish transient from permanent errors.

---

### 4. No Request Timeout (HIGH)
**Location:** `app/worker.py:11`

`requests.post()` has no `timeout` parameter. If the processor hangs on a connection, the request blocks indefinitely, pinning a worker thread until network timeout or manual intervention (which can take minutes to hours).

**Risk:** Thread pool exhaustion; cascading failures; complete worker unresponsiveness under partial processor failures.

---

### 5. Settings Defined But Unused (MEDIUM)
**Location:** `app/settings.py:4` and `app/worker.py`

`PROCESSOR_KEY`, `DATABASE_URL`, and `BATCH_SIZE` are defined but never used in the worker code. `PROCESSOR_KEY` suggests authentication is intended but not implemented. This indicates incomplete implementation or removed security controls.

**Risk:** Charges processed without authentication; no per-processor isolation; settings configuration provides false confidence in implementation completeness.

---

## Verification
- Reviewed worker.py charge loop and retry logic
- Analyzed exception handling and error paths
- Checked settings usage across codebase
- Examined deployment model (3 replicas) against idempotency guarantees
- Verified request configuration (timeout, headers, idempotency support)
