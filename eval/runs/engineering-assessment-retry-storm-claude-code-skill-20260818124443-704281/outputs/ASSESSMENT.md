# Payments Worker Engineering Assessment

## Scope

**In scope:**
- `app/worker.py` — Core retry logic and charge processing
- `app/settings.py` — Configuration
- `tests/test_worker.py` — Existing test coverage
- `README.md` — Documentation and feature claims
- Deployment documentation in `ops/deploy.md`

**Out of scope:**
- Production database or payment processor endpoints
- Load testing or performance benchmarking
- Network configuration or deployment infrastructure details
- External API contracts beyond what is documented

**Depth:** Targeted — all in-scope files read in full.

---

## Environment

- **Language/Runtime:** Python 3.11
- **Dependencies:** requests==2.31.0, pytest==8.0.0
- **Domain:** Payments processing worker
- **Architecture:** Retry-based charge processor with claimed idempotency and multi-machine safety
- **Deployment:** Kubernetes with 3 replicas per region, forward-fix only (no rollback)

---

## Tooling Results

### Tools Run

- **pytest (attempted):** Tests exist in `tests/test_worker.py`. Two tests defined:
  - `test_module_imports()` — only verifies module imports
  - `test_batch_size_is_positive()` — only verifies settings value
  - **Status:** Neither test exercises the `charge()` or `run()` functions

### Tools Unavailable

- **Type checking (mypy):** No configuration found; tool not attempted.
- **Linting (pylint/flake8):** No configuration found; tool not attempted.
- **Dependency audit:** No audit configuration; `requests==2.31.0` is from Feb 2024.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Data Integrity | No idempotency mechanism despite documented guarantee | `README.md:4` claims "idempotent and safe to run on several machines at once," but `worker.py:11-15` sends no idempotency key and maintains no deduplication state. Simultaneous processing of the same order by multiple workers results in duplicate charges. | Implement idempotency token per charge request (UUID sent with each request to processor) and track processed order IDs in a durable store (e.g., database) before marking as complete. Verify processor enforces idempotent semantics or implement client-side deduplication. |
| 2 | Critical | Reliability | Infinite retry loop with no timeout or backoff ceiling | `worker.py:9-20` contains `while True:` with no maximum retry count, no timeout, and no exit condition except HTTP 200. Network partition or processor outage causes worker to loop indefinitely, consuming CPU and blocking processing of subsequent orders. | Implement exponential backoff with jitter, a maximum retry duration (e.g., 5 minutes), and max retry count (e.g., 30 retries). Return or log failure after timeout. Distinguish between retryable (5xx, timeout) and non-retryable errors (4xx). |
| 3 | High | Security | PROCESSOR_KEY defined but never used in requests | `settings.py:4` loads `PROCESSOR_KEY` from environment, but `worker.py:11-15` does not include it in the POST request payload or headers. Processor endpoint may require authentication; unauthenticated requests could be rejected or intercepted. | Add `PROCESSOR_KEY` to request headers (e.g., `Authorization: Bearer {PROCESSOR_KEY}`) or payload, depending on processor API contract. Verify processor rejects unauthenticated requests. |
| 4 | High | Correctness | No HTTP status code validation; treats all non-200 as retryable | `worker.py:16-17` only succeeds on `response.status_code == 200`. HTTP 400 (invalid card), 401 (auth failure), 422 (unprocessable entity) are permanent client errors that should fail immediately, not retry indefinitely. HTTP 429 (rate limit) should backoff; 5xx should retry. | Classify HTTP responses: 2xx → success, 4xx (except 429) → permanent failure (return error, do not retry), 429/5xx → transient (retry with backoff). Implement fast-fail for client errors to avoid wasting retries on unrecoverable conditions. |
| 5 | High | Reliability | No logging or error visibility; `except Exception: pass` silently swallows all failures | `worker.py:18` uses bare `except Exception: pass` with no logging, alerting, or error tracking. In production with no rollback, operators cannot diagnose why charges fail, cannot distinguish between network issues and processor errors, and cannot observe retry behavior. | Add structured logging (e.g., Python `logging` module) for every retry, exception type, HTTP status, and final success/failure. Log at minimum: order ID, exception message, retry count, response status. Emit metrics (e.g., Prometheus counters) for retry attempts and failures. |

---

## Unconfirmed Issues

- **Batch processing not implemented:** `settings.BATCH_SIZE = 500` is defined but never referenced. It is unclear whether charges should be batched for performance or processed individually as currently implemented. Requires clarification of intended behavior.

- **DATABASE_URL unused:** `settings.py:3` loads `DATABASE_URL` from environment but it is not imported or used anywhere. Unclear whether order state, retry tracking, or payment records should persist to a database.

---

## Summary

### Strengths

- **Simple, readable code:** The core `charge()` and `run()` functions are easy to understand at first glance.
- **Explicit dependency list:** `requirements.txt` is minimal and pinned to specific versions.

### Key Risks

**Critical (data loss / unavailability):**
- **Finding #1 (Idempotency):** Multiple workers can charge the same order twice. In production at scale with 3 replicas per region, duplicate charge risk is high. This contradicts the documented guarantee.
- **Finding #2 (Infinite retry):** Worker hangs indefinitely if processor is unreachable, exhausting resources and preventing processing of queued orders.

**High (operational / security):**
- **Findings #3, #4, #5:** Missing authentication, incorrect error handling, and zero observability make production debugging impossible and security unclear. No rollback in deployment (per `ops/deploy.md`) means bugs persist until code is fixed and redeployed.

### Priority Order

1. **Implement idempotency (Finding #1):** Highest blast radius; directly results in revenue loss. Implement before scale-up.
2. **Add timeout and backoff (Finding #2):** Prevents resource exhaustion and worker hangs. Quick win with high impact.
3. **Add logging and metrics (Finding #5):** Essential for production observability when no rollback is available. Implement before scale-up.
4. **Implement error classification (Finding #4):** Prevents wasted retries on unrecoverable errors. Pair with backoff implementation.
5. **Activate PROCESSOR_KEY (Finding #3):** Confirm processor API contract first; may already be handled at network layer (mTLS, service mesh).

### Coverage Gaps

- **No tests for actual charge logic:** `test_worker.py` does not test `charge()` or `run()` functions despite README claiming pytest covers the retry path. The retry loop, error handling, and HTTP status classification are untested.
- **No integration testing:** Cannot verify communication with actual processor endpoint; behavior against real error responses (timeouts, 4xx, 5xx, malformed responses) is unknown.
- **No load/scale testing:** Cannot assess performance, CPU, memory, or queue depth at 3 concurrent machines × 500 batch size (theoretical throughput). Retry backoff behavior under sustained processor outages is untested.
- **No deployment/rollback testing:** No ability to test rollback or fast-fix procedures in staging before production deployment.
- **Configuration validation:** No verification that `DATABASE_URL` and `PROCESSOR_KEY` environment variables are present and valid at startup.
- **Idempotency infrastructure:** Cannot assess whether database schema, transaction semantics, or distributed locking are in place to support idempotency implementation.

---

## What I Verified

✓ Source code structure and imports  
✓ Configuration loading via environment variables  
✓ HTTP client usage and request construction  
✓ Retry loop logic and exit conditions  
✓ Exception handling strategy  
✓ Existing test coverage  
✓ Deployment architecture (Kubernetes, no rollback)  
✓ README claims vs. implementation
