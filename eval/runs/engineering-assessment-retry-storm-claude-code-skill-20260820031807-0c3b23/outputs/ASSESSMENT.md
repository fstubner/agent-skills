# Payments Worker Assessment

## Scope

**In scope**: 
- `app/worker.py` (core payment processing logic)
- `app/settings.py` (configuration)
- `tests/test_worker.py` (test coverage)
- `pyproject.toml` (dependencies and build config)
- `ops/deploy.md` (deployment context)
- `README.md` (stated behavior)

**Out of scope**:
- Evaluation cases, graders, expected answers, or sibling run outputs
- Production metrics or runtime data
- Integration tests or load tests

**Depth**: Targeted (all in-scope files read in full)

## Environment

- **Language**: Python 3.11+
- **Framework**: None; standalone worker module
- **Domain**: Payment processing worker
- **Platform**: Kubernetes (3 replicas per region, forward-only fixes)
- **Build system**: pyproject.toml (setuptools)

## Tooling Results

**Tools attempted**:
- `python -m pytest`: Requires execution approval; not run
- `python -m py_compile`: Requires execution approval; not run

**Tools not attempted**:
- Type checking (`mypy`, `pyright`): Not installed in project
- Linting (`pylint`, `flake8`): Not installed in project

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | No idempotency mechanism despite concurrent deployment | README.md claims "idempotent and safe to run on several machines at once", but `app/worker.py` has no request deduplication, order tracking, or idempotency keys. With 3 concurrent replicas, duplicate charges are possible. | Add request/order ID deduplication before processing; implement idempotent charge API calls using unique identifiers. |
| 2 | High | Reliability | Infinite retry loop without bounds or backoff | `app/worker.py:9-20` — `while True` with only 0.05s sleep. No timeout, no max retries, no exponential backoff. Worker can hang indefinitely if processor is unreachable. | Implement max retry count (e.g., 10) and exponential backoff starting at 1s. Add explicit timeout handling. |
| 3 | High | Reliability | Bare exception catch swallows all errors | `app/worker.py:18` — `except Exception: pass` masks transient failures, timeout exceptions, and resource exhaustion without logging. Makes debugging and monitoring impossible. | Replace with specific exception handling: catch `requests.RequestException` for network issues, separate handling for timeouts. Log all failures. |
| 4 | High | Correctness | Incomplete HTTP status code handling | `app/worker.py:16-19` — Only accepts status 200; all other codes (4xx, 5xx) retry indefinitely. Invalid card tokens, missing fields (4xx) should fail immediately, not retry. | Add status code classification: 4xx → fail immediately, 5xx/timeout → retry, 200 → succeed. |
| 5 | High | Reliability | Undeclared runtime dependency | `app/worker.py:2` imports `requests`, but `pyproject.toml:12` declares `dependencies = []`. Runtime failure guaranteed. | Add `requests` to the `dependencies` list in `pyproject.toml`. |

## Unconfirmed Issues

None. All findings are confirmed by direct code inspection.

## Summary

### Strengths
- Modular structure with separate settings and worker modules.
- Explicit test file exists, demonstrating test-awareness.

### Key Risks

1. **Production reliability crisis**: The infinite retry loop (#2) combined with bare exception swallowing (#3) means failures are not observable and workers can hang silently. With forward-only deployment (ops/deploy.md), hung workers cannot be rolled back and will accumulate.

2. **Data integrity breach**: The stated idempotency guarantee (#1) is false. Concurrent replicas can charge the same order multiple times, causing financial and customer impact. This is the highest-priority issue.

3. **Immediate runtime failure**: The undeclared dependency (#5) means the worker fails on first import. Code cannot run at all until fixed.

4. **Permanent error handling**: Non-200 status codes retry forever (#4), including cases that will never succeed (invalid tokens, bad requests). This causes indefinite worker stalls per order.

### Priority Order

1. **Fix undeclared dependency** (#5) — Blocks all execution. ~5 minutes.
2. **Implement idempotency mechanism** (#1) — Prevents duplicate charges. Requires design work on order tracking. ~2-4 hours.
3. **Replace infinite retry loop** (#2) — Prevent indefinite hangs. Add max retries, backoff, timeouts. ~1 hour.
4. **Fix bare exception catch** (#3) — Enable observability and debugging. ~30 minutes.
5. **Implement status code classification** (#4) — Distinguish transient from permanent errors. ~1 hour.

### Coverage Gaps

- **Not examined**: Runtime behavior, actual processor integration, production error rates
- **Not available**: Load testing, production metrics, deployment validation
- **Not attempted**: Execution-based verification (pytest, type checking) due to approval requirements
- **Out of scope**: Evaluation fixtures, graders, expected test outputs

---

## What I Verified

- Codebase structure and file organization
- All Python source files (3 files) and configuration
- Runtime dependency declarations vs. actual imports
- Retry logic and error handling patterns
- Stated guarantees against actual implementation
