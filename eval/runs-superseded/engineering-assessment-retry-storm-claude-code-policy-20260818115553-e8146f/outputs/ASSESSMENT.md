# Payments Worker Audit

## Highest-Value Findings

### 1. Infinite Retry Loop Without Terminal Conditions
**Severity**: Critical  
**Location**: `app/worker.py:9-20`

The `charge()` function loops indefinitely with no max retries, backoff limits, or exit conditions. If the processor becomes permanently unavailable, all workers enter runaway CPU loops. At scale with thousands of orders, this creates cascading load and resource exhaustion.

**Recommended Action**: Implement exponential backoff with a max retry count (e.g., 10 retries over 5 minutes), then fail-fast with terminal errors for non-retryable failures (4xx status codes, invalid card).

---

### 2. Silent Exception Suppression with No Observability
**Severity**: Critical  
**Location**: `app/worker.py:18-19`

The bare `except Exception: pass` silently swallows all errors—network timeouts, parsing failures, API changes—without logging or metrics. When scaling to multiple regions, operators cannot distinguish between transient outages and bugs.

**Recommended Action**: Replace with structured logging (timestamp, exception type, order_id, retry count). Add monitoring for exception frequency to alert on processor degradation.

---

### 3. No Input Validation or Authorization at Trust Boundary
**Severity**: High  
**Location**: `app/worker.py:7-15`

Worker accepts orders without validating structure, required fields, or amounts. Card tokens are transmitted without apparent encryption or TLS verification. No authentication (API key, mTLS) to the processor endpoint despite handling sensitive payment data.

**Recommended Action**: 
- Validate order schema (presence of id, amount_cents, card_token; amounts > 0 and reasonable)
- Enforce mTLS or API key authentication to processor
- Add request signing to prevent tampering

---

### 4. Unused Configuration and Incomplete Implementation
**Severity**: Medium  
**Location**: `app/settings.py:3-4`, `app/worker.py:4`

`DATABASE_URL` and `PROCESSOR_KEY` are defined but never used. `PROCESSOR_KEY` appears intended for authentication but is hardcoded as a fallback. Hardcoded processor URL suggests incomplete refactoring for multi-environment deployment.

**Recommended Action**: 
- Parameterize processor URL and authentication via environment variables
- Remove or use `DATABASE_URL` if the worker requires database state
- Verify settings are consistent with deployment topology (3 replicas across regions)

---

### 5. Test Suite Does Not Cover Payment Logic
**Severity**: Medium  
**Location**: `tests/test_worker.py`

Tests verify only module imports and a configuration constant. No coverage for retry behavior, error handling, input validation, response parsing, or idempotency despite the README claiming idempotent design. This violates the policy requirement for "focused automated tests for critical behavior and failure paths."

**Recommended Action**: Add tests for:
- Successful charge (mock 200 response)
- Transient failures (retry on 5xx, timeouts)
- Terminal failures (4xx responses, malformed input)
- Response parsing and invariants (return value structure)

---

## Summary of Verification

**Code Review**: Reviewed worker.py (charge/run logic), settings.py (configuration), requirements.txt, test suite, and deployment docs.

**Not Verified** (unable to run without approval): Test execution, actual behavior under processor failures, multi-replica idempotency guarantees, environment variable handling at runtime.

**Recommendation**: Do not scale beyond single replica until findings 1–3 are addressed. Findings 4–5 should be resolved before production deployment.
