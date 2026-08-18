# Payments Worker Engineering Assessment

## Scope

**In Scope:**
- `app/worker.py` — Core charge and retry logic
- `app/settings.py` — Configuration
- `tests/test_worker.py` — Test coverage
- `requirements.txt` — Dependencies
- `ops/deploy.md` — Deployment context

**Out of Scope:**
- External processor API behavior and specification
- Production database schema or operational metrics
- Kubernetes deployment configuration beyond ops/deploy.md
- Load testing or stress testing results

**Depth:** Targeted — all in-scope files read in full.

---

## Environment

**Language & Runtime:** Python 3 (inferred from `.py` extension and pytest usage)

**Key Dependencies:**
- `requests==2.31.0` — HTTP library for processor API calls
- `pytest==8.0.0` — Testing framework

**Domain:** Payments worker service for processing charge retries.

**Platform:** Kubernetes-deployed microservice (three replicas per region, no rollback capability).

---

## What I Ran

**Attempted Commands:**
- `python -m pytest tests/ -v` — Could not execute (blocked by permission check); would have verified test suite execution.

**Reason for inability to run:** Shell execution requires approval; test output not captured.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Data Integrity | Idempotency claim contradicted by missing idempotency key in API calls | `README.md:4` claims worker is "idempotent and safe to run on several machines at once"; `app/worker.py:11-15` has no idempotency-key header or parameter in processor request | Add an idempotency key (e.g., derived from order_id + timestamp or a request ID) to the processor request to ensure duplicate calls return the same result rather than charging twice. |
| 2 | High | Reliability | Infinite retry loop with no maximum attempts or circuit breaker | `app/worker.py:9-20` — `while True:` with bare `except Exception:` and only `time.sleep(0.05)` between retries; no attempt limit, timeout, or exponential backoff | Implement a maximum retry count (e.g., 10 attempts) and exponential backoff to prevent resource exhaustion. Fail fast and explicitly log when max retries exceeded. |
| 3 | High | Correctness | Non-200 responses are silently retried, including permanent failures | `app/worker.py:16-17` — only checks `if response.status_code == 200` to return; other status codes (e.g., 400, 401, 403, 422) are retried infinitely as if they were transient | Distinguish transient (5xx, 429) from permanent (4xx) failures. Permanent failures should be logged and returned/rejected immediately, not retried. |
| 4 | High | Reliability | Bare except clause silently swallows all exceptions, hiding real errors | `app/worker.py:18-19` — bare `except Exception:` without logging means connection errors, timeouts, and invalid JSON responses are all silently ignored and the loop retries | Replace bare except with specific exception handling: log each exception type, distinguish timeout/network errors (retry) from code errors (fail). Add logging to track retry reasons. |
| 5 | Medium | Maintainability | PROCESSOR_KEY setting defined but never used | `app/settings.py:4` loads `PROCESSOR_KEY` from environment; `app/worker.py` never references or uses this key | Either remove the unused setting or implement authentication if the processor requires it. If intentionally unused, document why. Clarify whether the processor endpoint is public or protected. |

---

## Unconfirmed Issues

**Potential but not definitively confirmed by code inspection:**

1. **Missing HTTPS enforcement**: The `PROCESSOR` URL in `app/worker.py:4` is hardcoded as `https://cards.example.com/v1/charge` (example domain), so actual enforcement cannot be verified without seeing the runtime environment or configuration. However, if this URL is ever changed to HTTP, card tokens would be transmitted insecurely.

2. **Response contains sensitive data**: `app/worker.py:17` returns `response.json()` without filtering. If the processor echoes back the card_token or other sensitive fields, they would be logged or returned to callers. This depends on processor API behavior.

3. **No request timeout**: `requests.post()` in `app/worker.py:11` has no explicit timeout. If the processor hangs, the sleep(0.05) retry loop could hang indefinitely per attempt (default requests timeout is 300 seconds per connection).

---

## Summary

### Strengths

1. **Simple, focused implementation**: The worker module is small (27 lines) and has one clear responsibility—charge an order with retry logic. No unnecessary abstraction or plumbing.

2. **Externalized configuration**: Use of `os.environ` for sensitive settings (DATABASE_URL, PROCESSOR_KEY) and batch-size configuration is correct; secrets are not hardcoded in source.

### Key Risks

**Critical:**
- **Finding #1 (Idempotency)**: The README promises idempotency but the code does not implement it. Duplicate charges are possible if retries fire concurrently or if the same order is processed twice. This is a data-loss/revenue risk.

**High:**
- **Findings #2, #3, #4 (Retry logic)**: The infinite retry loop, lack of status-code differentiation, and silent error swallowing combine to create a brittle, debugging-hostile retry strategy. Transient and permanent failures are treated identically, and no visibility into why retries happen.

### Priority Order

1. **Implement idempotency key** (Finding #1) — Prevents silent charge duplication. Required before scaling.
2. **Add maximum retry attempts and distinguish 4xx from 5xx** (Findings #2, #3) — Prevents resource exhaustion and permanent failures from looping forever.
3. **Add logging for exceptions and retries** (Finding #4) — Operational visibility to diagnose failures in production.
4. **Clarify or remove PROCESSOR_KEY** (Finding #5) — Removes ambiguity about authentication; low effort.

### Coverage Gaps

- **No test execution**: Unable to run `pytest` to verify that the test suite actually covers the retry path. The README claims pytest covers this, but the actual test file (`tests/test_worker.py`) contains only two trivial tests: module import and BATCH_SIZE validation. No tests for retry behavior, error handling, or status code responses observed.
- **No load/performance testing**: No evidence of how the worker behaves under sustained load or high retry rates.
- **No deployment or operational metrics**: No access to production logs, error rates, or SLA requirements.
- **No processor API documentation**: Behavior of the processor endpoint (what status codes it returns, whether it supports idempotency keys, timeout behavior) is inferred from context only.
- **Database interaction not visible**: The README and code reference DATABASE_URL and BATCH_SIZE, but no actual database query or batch-processing logic is present in the audited files. The full worker integration is out of scope.

---

## What Was Verified

Performed static code analysis of all Python source files in the `app/` and `tests/` directories. Reviewed configuration, dependencies, and deployment context. Identified five high-severity issues affecting reliability, data integrity, and operational visibility. No automated test execution, linting, or type checking was performed (tool execution required approval). Assessment is based on code inspection and context from README and deployment docs.
