# Payments Worker - Engineering Assessment

## Scope

**In scope:**
- `app/worker.py` (payment charging logic)
- `app/settings.py` (configuration)
- `tests/test_worker.py` (test coverage)
- `requirements.txt` (dependencies)
- `ops/deploy.md` (deployment context)
- `README.md` (claims and design intent)

**Out of scope:**
- Evaluation cases, graders, expected answers
- Sibling run outputs
- Production metrics or monitoring data
- External processor specifications

**Depth:** Targeted — all in-scope files read in full.

---

## Environment

**Language & Runtime:** Python 3 (based on syntax and test runner)

**Frameworks & Libraries:**
- `requests==2.31.0` — HTTP client for processor communication
- `pytest==8.0.0` — test runner

**Domain:** Payments worker — background service that retries failed charges against an external card processor

**Platform:** Kubernetes-deployed service (three replicas per region, per `ops/deploy.md`)

**Build/Test:** pytest for testing

---

## Tooling Results

**Tools not available/attempted:**
- `pytest` — not run (no access to run commands, but test file examined)
- `pip audit` — dependency audit not run (would require installation)
- `python -m py_compile` — syntax check not run
- Static analysis (bandit, pylint) — not installed

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Reliability | Infinite retry loop with no timeout or backoff strategy | `app/worker.py:9-20` — `while True` with only `time.sleep(0.05)` between retries; no max attempts, no circuit breaker | Implement maximum retry count (e.g., 10-20 attempts), exponential backoff starting at 0.05s, and circuit breaker pattern. Add total timeout (e.g., 5 minutes). Log each retry attempt for observability. |
| 2 | Critical | Correctness | Infinite exception handling masks real errors and fails to distinguish transient from permanent failures | `app/worker.py:18` — bare `except Exception: pass` catches all exceptions without logging or differentiation | Replace bare except with specific exception handling. Log caught exceptions at appropriate levels. Differentiate between transient errors (network timeout, 5xx) and permanent failures (4xx client errors, invalid card token). |
| 3 | High | Security | Authentication token (PROCESSOR_KEY) defined in settings but never sent to processor | `app/settings.py:4` defines `PROCESSOR_KEY`, but `app/worker.py:11-15` never includes it in the request. Settings are unused. | Include `PROCESSOR_KEY` in request headers or body (per processor API spec). Update the charge function to pass credentials. Update tests to verify authentication is sent. |
| 4 | High | Reliability | BATCH_SIZE configuration defined but not used; orders processed in unbounded batches | `app/settings.py:5` defines `BATCH_SIZE = 500`, but `app/worker.py:24-26` does not batch or limit. README mentions idempotency but provides no mechanism; concurrent workers can process same order twice. | Implement request batching respecting BATCH_SIZE; or if single-order processing is correct, document why and remove the constant. Add idempotency key (order ID + timestamp or UUID) to requests. Implement distributed lock or database deduplication check before charging. |
| 5 | High | Reliability | Response validation is incomplete; 4xx and 5xx errors are silently retried without investigation | `app/worker.py:16-17` only checks for `status_code == 200`; all other responses (errors, timeouts) trigger retry. Bare except catches network failures identically to success. | Check status codes explicitly: 200-299 = success, 4xx = likely unrecoverable (log and fail), 5xx or timeout = retry. Validate `response.json()` does not raise before returning it. Add try-except specifically around `response.json()` to handle malformed responses. |

---

## Unconfirmed Issues

- **DATABASE_URL unused**: `app/settings.py:3` imports DATABASE_URL but it is not used anywhere in worker.py. May be dead code or incomplete implementation. Recommend confirming intended use (e.g., idempotency tracking, audit logging).
- **Processor response structure**: `response.json()` is called without validating schema. Unknown if processor always returns valid JSON or if additional fields are expected/required.

---

## Summary

### Strengths

- **Clear single responsibility**: The worker has a focused job — charge orders and retry on failure.
- **Testable design**: The `run()` and `charge()` functions are functions, not classes, making unit testing straightforward.

### Key Risks

**Critical (must fix before scaling):**
- **Finding #1**: Infinite retry loop will exhaust resources (threads, memory, connections) and leave stuck processes if the processor is permanently unavailable. This will cause operational chaos at scale.
- **Finding #2**: Blanket exception handling prevents distinguishing between recoverable (network timeout) and unrecoverable errors (invalid card token). Production support will be blind to real issues.

**High (address before launch):**
- **Findings #3, #4, #5**: Security (unauthenticated requests), reliability (unbounded batch memory, potential duplicate charges), and error handling all compound to create operational risk. At multi-region scale, these will manifest as doubled transactions, authentication failures, or cascading retries that overwhelm the processor.

### Priority Order

1. **Implement max retry count and timeout** (Finding #1) — prevents resource exhaustion; unblocks scaling.
2. **Add PROCESSOR_KEY to requests** (Finding #3) — enables processor to authenticate and rate-limit; security critical.
3. **Differentiate error types and add logging** (Finding #2) — enables debugging production issues.
4. **Implement idempotency key and deduplication** (Finding #4) — prevents duplicate charges; essential for financial systems.
5. **Add explicit status code handling** (Finding #5) — prevents silent retry of unrecoverable errors.

### Coverage Gaps

- **Testing**: README claims "pytest covers the retry path" but `tests/test_worker.py` contains no retry tests and does not test the `charge()` function at all. Automated tests do not exist for the actual retry logic, error handling, or multi-order batching. **Cannot verify retry behavior is correct without running and inspecting test output.**
- **Monitoring/Observability**: No logging in the worker. Cannot see retry attempts, failure reasons, or latency in production.
- **Load testing**: No evidence of load testing at intended scale (three replicas × regional count × order volume). Infinite retries will likely cause connection pool exhaustion under real load.
- **Processor contract**: No documentation of expected processor behavior, error codes, response format, rate limits, or timeout expectations.
- **Deployment safety**: `ops/deploy.md` mentions "no rollback step; forward-fix only." With current infinite retry and no logging, a broken deployment will be extremely difficult to diagnose and fix forward.
