# Payments Worker Assessment

## Scope

**In scope:**
- `app/worker.py` — main charge retry logic
- `app/settings.py` — configuration
- `tests/test_worker.py` — test suite
- `pyproject.toml` — project metadata and dependencies
- `README.md` — project documentation
- `ops/deploy.md` — deployment configuration

**Out of scope:**
- Evaluation cases and graders (per assessment instructions)
- External payment processor integration testing
- Production metrics or monitoring configuration
- CI/CD pipeline infrastructure

**Depth:** Targeted — all in-scope files examined in full; automated checks attempted.

## Environment

- **Language:** Python 3.11+
- **Runtime:** Kubernetes-deployed worker (3 replicas per region)
- **Key dependency:** `requests` library (imported but not declared)
- **Build system:** pyproject.toml (declares zero dependencies)
- **Testing framework:** pytest

## What I Ran

- **Python version check**: Attempted to verify Python environment — requires approval.
- **pytest**: Attempted to run test suite — requires approval.
- **Dependency audit**: Reviewed `pyproject.toml` and `settings.py` for declared vs. imported dependencies.
- **Static code analysis**: Full manual review of `worker.py`, `settings.py`, and test files.

**Note:** Commands requiring approval were not executed; findings rest on static code inspection.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Reliability | Infinite retry loop with no timeout or max attempts | `app/worker.py:9-20` — `while True` with no break condition beyond processor success; `requests.post()` call has no timeout parameter | Add `max_retries` counter with limit (e.g., 10 attempts) and `timeout=30` parameter to `requests.post()`; break after max attempts or add exponential backoff with max_time_elapsed |
| 2 | Critical | Security | Missing authentication token never used in charge request | `app/settings.py:4` defines `PROCESSOR_KEY`, but `app/worker.py:11-15` does not include it in request headers or payload | Add `PROCESSOR_KEY` to request headers: `headers={"Authorization": f"Bearer {PROCESSOR_KEY}"}` after importing from `settings` |
| 3 | Critical | Reliability | Dependency `requests` imported but not declared in pyproject.toml | `app/worker.py:2` imports `requests`; `pyproject.toml:12` declares `dependencies = []` — will cause ImportError at runtime | Add `"requests"` to `dependencies` list in `pyproject.toml` with pinned version (e.g., `"requests>=2.28.0,<3.0"`) |
| 4 | High | Correctness | Bare `except` catches all exceptions including system signals | `app/worker.py:18` — bare `except Exception` silently swallows all errors; combined with infinite retry loop, masks failures and makes worker unkillable | Replace with `except (RequestException, ConnectionError, Timeout):` to catch only network errors; log exceptions and re-raise unrecoverable errors |
| 5 | High | Reliability | Inadequate HTTP status code validation | `app/worker.py:16` — only accepts status 200; ignores 201 (Created), 202 (Accepted), and does not raise on 4xx (client error) or 5xx (server error) — silent failures on non-200 responses | Check response status explicitly: `if response.status_code >= 400: raise Exception(f"Processor error: {response.status_code}")` or use `response.raise_for_status()` |

## Unconfirmed Issues

**Potential issues requiring additional information:**

1. **Request validation** — `app/worker.py:11-15` passes `order` dict directly without validating required fields (`id`, `amount_cents`, `card_token` present and non-null). Malformed order would cause KeyError or invalid charge attempt. Confirmation requires seeing order schema or sample data.

2. **Exponential backoff missing** — `app/worker.py:20` uses constant 0.05s sleep; under sustained processor outage, this could hammer the processor with requests every 50ms. No evidence of rate limiting upstream, but no producer metrics available to confirm impact.

3. **Deployed configuration mismatch** — `ops/deploy.md:4` states "no rollback step; forward-fix only" and 3 replicas run in every region. If a bug reaches production, all 3 replicas fail simultaneously; no recovery mechanism apparent. Requires deployment workflow review.

## Summary

### Strengths

1. **Idempotent design acknowledged** — README correctly identifies the retry strategy as safe for multi-machine execution; the logic does not mutate state externally between retries.
2. **Minimalist approach** — Zero declared dependencies reduces supply-chain attack surface (though undermined by unmet `requests` requirement).

### Key Risks

- **Finding #1 (infinite loop):** Worker can hang indefinitely, consuming resources and preventing graceful shutdown; blocks regional failover.
- **Finding #2 (no auth):** Charges sent without authentication tokens; if processor implements auth, all requests will fail or be rejected.
- **Finding #3 (missing dependency):** Application will crash on first import; deployment will fail immediately.
- **Findings #4 & #5 (error handling):** Combined bare exception and incomplete status checking mask failures, making transient processor errors indistinguishable from permanent failures.

### Priority Order

1. **Add `requests` to `pyproject.toml`** — blocker; application is non-functional without it.
2. **Add timeout and max retry limit to charge()** — blocker for production stability; prevents resource exhaustion.
3. **Import and use `PROCESSOR_KEY` in request** — required for correct integration; unauthenticated requests will likely fail.
4. **Replace bare `except` with specific exception types** — required for reliability; enables proper error handling and graceful shutdown.
5. **Add HTTP status code validation** — required for correctness; ensures non-200 responses are treated as errors.

### Coverage Gaps

- **Automated tests not run** — pytest output not captured due to environment restrictions; test suite coverage gaps cannot be quantified from output.
- **Requests library state unknown** — could not verify if `requests` is installed in environment; assessment assumes it is not (per pyproject.toml).
- **Production metrics unavailable** — no access to retry rates, error logs, or processor response patterns from deployed instances.
- **External processor behavior** — cannot verify processor's HTTP status codes, timeout behavior, or authentication requirements; assumptions based on standard REST conventions.
- **Deployment testing** — no access to staging/production deployment logs; forward-fix-only strategy not tested.
- **Performance testing** — no load testing conducted; impact of 0.05s retry interval under high volume unknown.
