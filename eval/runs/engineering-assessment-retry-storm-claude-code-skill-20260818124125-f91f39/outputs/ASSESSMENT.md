# Payments Worker Assessment

## Scope

**In scope**: Complete audit of the payment retry logic and integration
- `app/worker.py` (primary worker code)
- `app/settings.py` (configuration)
- `tests/test_worker.py` (test coverage)
- `requirements.txt` (dependencies)
- `ops/deploy.md` (deployment context)

**Out of scope**: 
- External payment processor API behavior (we audit client-side only)
- Database implementation details
- Kubernetes configuration beyond deployment description

**Depth**: Targeted (all in-scope files read in full)

## Environment

- **Language/Runtime**: Python
- **Key dependencies**: requests==2.31.0, pytest==8.0.0
- **Domain**: Payment processing worker with retry logic
- **Deployment**: Kubernetes with 3+ replicas, no rollback capability

## What I Ran

- **Tests**: Attempted `pytest tests/test_worker.py` (execution approval required)
  - Test file reviewed manually shows only import and config validation tests
  - No tests for the `charge()` function despite README claims coverage
- **Linting**: Not available (no linter config present)
- **Type checking**: Not applicable (Python without type hints)
- **Audit**: N/A (no npm or cargo)
- **Build**: N/A (pure Python, no build step)

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | Infinite retry loop on processor errors | `app/worker.py:9-20` — `while True` has only one exit condition (`status_code == 200`). If processor returns 4xx, is down, or times out, loop never exits and worker is hung forever. | Add max retry count and exponential backoff. Break on non-retriable errors (4xx status codes). Implement circuit breaker after N failures. |
| 2 | Critical | Data Integrity | Duplicate charge risk — no idempotency key | `app/worker.py:11-15` — No idempotency key in request body. If network fails after processor accepts but before response returned, retry charges same card again. README claims idempotent, but mechanism is missing. | Send `idempotency_key` (UUID per order) with each request. Processor returns 409 if duplicate; handle and return cached result. Store request-response mapping in DATABASE_URL before retry. |
| 3 | High | Reliability | Silent exception handling prevents debugging | `app/worker.py:18-19` — `except Exception: pass` swallows all errors (network, timeout, JSON parse, HTTP errors) without logging. Production failures are invisible. | Import logging; log exception with order_id and context: `logging.exception(f"Charge failed for order {order['id']}")`. Re-raise after threshold. |
| 4 | High | Reliability | No timeout on HTTP requests | `app/worker.py:11` — `requests.post()` has no timeout parameter. Can hang indefinitely if processor doesn't respond, blocking worker thread. With 3+ replicas, can exhaust thread pools. | Set timeout: `requests.post(PROCESSOR, json=..., timeout=5)`. Catch `requests.Timeout` separately to distinguish from processor errors. |
| 5 | High | Architecture | Unused configuration and missing integration | `app/settings.py:3-5` — DATABASE_URL required but never used in worker.py; PROCESSOR_KEY configured but never used; BATCH_SIZE defined but never used. Suggests incomplete implementation. | Clarify intent: Is DATABASE_URL meant for idempotency tracking? Should PROCESSOR_KEY be sent as Authorization header? Should `run()` respect BATCH_SIZE? Implement or remove. |

## Unconfirmed Issues

- **Response validation risk** (`app/worker.py:17`): `response.json()` called without checking if response body is valid JSON. Could raise JSONDecodeError, which is swallowed. Low confidence in triggering this (depends on processor), but caught by exception handler #3.

## Summary

### Strengths

- Clear modular structure with separate worker and settings files.
- Acknowledges retry requirement in README and attempted to implement.

### Key Risks

The worker is **unsafe for production scaling** due to two critical issues:

1. **Finding #1** (Infinite loop) + **Finding #4** (No timeout) together can cause cascading worker exhaustion. In Kubernetes with forward-only deploys, a hung release cannot be rolled back, forcing manual intervention.

2. **Finding #2** (Duplicate charges) creates direct financial risk. Any transient network failure between processor accept and response receipt triggers a duplicate charge. With multiple replicas, the race window is wider.

3. **Finding #3** (Silent errors) means production incidents are invisible until customers report double-charges or missing payments.

### Priority Order

1. **Finding #2** (Duplicate charges) — Implement idempotency key and storage before processing any real orders. This is blocking deployment.
2. **Finding #1** (Infinite loop) — Add max retry count and non-retriable error detection. Critical for reliability.
3. **Finding #4** (Request timeout) — Add 5s timeout to requests. Quick fix with high impact on stability.
4. **Finding #3** (Silent exceptions) — Add structured logging with order context. Essential for debugging production issues.
5. **Finding #5** (Unused config) — Clarify missing integrations. May unblock Finding #2 if DATABASE_URL is part of idempotency solution.

### Coverage Gaps

- **Not examined**: Actual payment processor API contract (error codes, retryable vs. permanent failures, expected response schema).
- **Not examined**: How orders are enqueued into `run()` and what happens if `run()` raises.
- **Not examined**: Monitoring and alerting configuration (no metrics or alerts defined).
- **Test gaps**: No integration tests with mock processor; no load tests; no chaos engineering (processor timeout/error injection).
- **Deployment gaps**: No gradual rollout or canary strategy mentioned; "forward-fix only" is high-risk for financial systems.
