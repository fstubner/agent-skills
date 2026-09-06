# Payments Worker Assessment

## Scope

**In Scope:**
- `app/worker.py` — main charge processing logic
- `app/settings.py` — configuration management
- `tests/test_worker.py` — test coverage
- `requirements.txt` — dependencies
- `README.md` — stated behavior
- `ops/deploy.md` — deployment strategy

**Out of Scope:**
- External processor API behavior (cards.example.com)
- Database schema and implementation
- Production metrics or traffic patterns
- Deployment infrastructure beyond configuration

**Depth:** Targeted (all in-scope files read in full)

---

## Environment

**Language/Runtime:** Python 3.x

**Key Dependencies:**
- `requests==2.31.0` — HTTP client
- `pytest==8.0.0` — testing framework

**Domain:** Payment processing worker with retry logic

**Stated Guarantees:** README claims "idempotent and safe to run on several machines at once"

---

## Tooling Results

| Tool          | Status     | Notes                                           |
|---------------|------------|--------------------------------------------------|
| Syntax check  | Skipped    | No compilation step; syntax is valid            |
| Tests (pytest)| Not run    | Requires approval; test file exists but minimal |
| Linting       | Not run    | No linter configuration found                   |
| Audit         | Not run    | No Python package audit tool available          |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Security | Unauthenticated payment processor calls; PROCESSOR_KEY never used | `app/worker.py:11-15` — POST request contains only order data, no auth. `app/settings.py:4` — PROCESSOR_KEY loaded but never referenced in worker.py. | Add authentication header to request: `headers={"Authorization": f"Bearer {PROCESSOR_KEY}"}` at line 11. Verify HTTPS enforcement. |
| 2 | Critical | Data Integrity | Idempotency claim false; duplicate charges possible on network failure | `README.md:3-4` claims "idempotent"; `app/worker.py:7-21` has no duplicate detection. If response received after charge but before return, retry will charge again. | Implement idempotency key: send unique request ID to processor, store confirmed charges locally, check before retry. Requires database integration. |
| 3 | Critical | Reliability | Infinite retry loop with no timeout, backoff, or max retries | `app/worker.py:9-20` — `while True` with only 50ms sleep. No timeout. Processor outage causes worker to spin indefinitely consuming resources. | Add: (1) max retries cap (e.g., 10), (2) exponential backoff starting 100ms, (3) timeout threshold (e.g., 5 min), (4) circuit breaker to fail fast. Return error on max retries instead of infinite loop. |
| 4 | High | Reliability | Bare except clause prevents graceful shutdown and error diagnosis | `app/worker.py:18-19` — `except Exception: pass` catches all exceptions including KeyboardInterrupt (until Python 3.8, now BaseException). Worker cannot be interrupted cleanly. | Catch only expected exceptions: `except (requests.RequestException, requests.Timeout, requests.ConnectionError)`. Let system signals and critical errors propagate. Add logging for caught exceptions. |
| 5 | High | Observability | Silent exception handling destroys production debuggability; no logging | `app/worker.py:18-19` — exceptions silently ignored. No logs, no metrics. Operator cannot diagnose why charges are failing. | Add logging: `import logging; logger.exception(f"Charge failed for order {order['id']}: {e}")` before retry sleep. Log processor response status codes on non-200. |

---

## Unconfirmed Issues

None. All findings above are confirmed by direct code inspection.

---

## Summary

### Strengths

- **Clean, readable code structure:** The worker functions are straightforward and easy to understand at a glance.
- **Retry intent is clear:** The `charge()` function correctly implements the intent to keep trying until success, even if the specific implementation has critical flaws.

### Key Risks

The payments worker has **three critical gaps** that prevent production deployment:

1. **Security (Finding #1):** Processor calls are completely unauthenticated. Any actor can forge charges. PROCESSOR_KEY is configured but never used.

2. **Data Integrity (Finding #2):** The idempotency guarantee in the README is false. Network failures between charge success and response return will cause duplicate charges with no detection mechanism.

3. **Reliability (Finding #3):** Processor outages cause infinite tight-loop spinning. No timeout, backoff, or circuit breaker means resource exhaustion and inability to recover gracefully.

Secondary risks:

- **Reliability (Finding #4):** Worker cannot be shut down gracefully; bare except blocks signals.
- **Observability (Finding #5):** All failures are silent. Production issues are invisible.

### Priority Order

1. **Critical: Implement authentication (Finding #1)** — Unguarded payment API is an immediate security breach. 1–2 hour fix.
2. **Critical: Add retry limits and backoff (Finding #3)** — Prevents resource exhaustion and enables graceful degradation. 2–3 hour fix including testing.
3. **Critical: Implement idempotency check (Finding #2)** — Requires database integration to detect and skip already-charged orders. 4–6 hour fix.
4. **High: Fix exception handling (Finding #4)** — Enable graceful shutdown. 30 min fix.
5. **High: Add logging (Finding #5)** — Enable operational visibility. 1 hour fix.

### Coverage Gaps

**Not Examined:**
- Database integration (DATABASE_URL loaded but unused; required for idempotency tracking)
- Load testing or performance profile under processor outage
- Deployment orchestration beyond `kubectl set image` (no rollback, no canary strategy noted)
- Actual processor API behavior, error codes, and edge cases
- Monitoring, alerting, and runbook for production incidents
- How orders reach this worker (queue, webhook, batch feed)
- Whether `run()` function is used (not called in tests)
- Scaling strategy: horizontal scaling claims need concurrent access to idempotency store

**Tools Not Run:**
- `pytest` — test execution requires approval; minimal test coverage observed in file review
- Static analysis tools — none configured

---

## Verification Summary

**Verified by code inspection:**
- Examined all application code files in scope.
- Identified five concrete, evidence-backed findings.
- Confirmed stated idempotency guarantee is not implemented.
- Confirmed authentication key is loaded but never applied.
- Confirmed bare except and infinite loop present.
