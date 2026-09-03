# Engineering Assessment: Payments Worker

## Scope

**In scope:**
- `app/worker.py` — main charge processing logic and retry mechanism
- `app/settings.py` — configuration and constants
- `tests/test_worker.py` — test suite
- `README.md` — project documentation
- `ops/deploy.md` — deployment strategy

**Out of scope:**
- External processor API behavior and documentation
- Production database configurations
- Network topology and infrastructure details
- Load testing or performance benchmarking
- Integration with payment gateway authentication flows beyond what appears in code

**Depth:** Targeted — all in-scope files read in full; automated checks attempted but limited by environment constraints.

---

## Environment

**Language & Runtime:** Python 3.11+
**Domain:** Payments processing worker — charges credit cards with retry logic
**Platform:** Server-side application (Kubernetes deployment, 3 replicas per region)
**Build system:** Python with pytest (test framework declared in imports)
**Key concerns:** Data integrity (financial transactions), reliability (retry safety), security (card data handling)

---

## Tooling Results

**What I ran:**

| Check | Command | Result |
|-------|---------|--------|
| Tests | `pytest tests/ -v` | **Could not run** — requires user approval to execute Python tools in this environment. |
| Type check | `mypy app/` | **Not attempted** — no mypy configuration found; tool availability unknown. |
| Lint | `pylint` or `flake8` | **Not attempted** — no lint configuration found; not standard in project. |
| Audit | `pip-audit` | **Not attempted** — no dependencies declared in pyproject.toml (by design per comments). |
| Format check | `black --check` | **Not attempted** — no formatter config found. |

**Tools that failed:** pytest could not be executed due to environment approval constraints.

**Tools not attempted:** mypy, pylint, black — no configuration files found in repository; project does not declare these as requirements.

**Tools unavailable:** None definitively unavailable, but pytest execution blocked by permission model.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Reliability | Infinite retry loop with no timeout | `app/worker.py:9-20` — `while True:` loop has no max attempts, timeout, or exit condition. If the processor is down, `charge()` will block indefinitely. | Add a `max_retries` limit and a deadline timestamp. Fail fast with a descriptive error after N retries or T seconds. |
| 2 | High | Reliability | Bare exception handler masks all errors | `app/worker.py:18` — `except Exception:` (line 18) catches and silently ignores *all* exceptions, including corrupted responses, network timeouts treated as retryable, and logic errors. This obscures failure modes and prevents proper error handling. | Replace with specific exception catching (e.g., `requests.RequestException` for network errors). Log every exception and categorize: retry-able vs. terminal. |
| 3 | High | Data Integrity | No idempotency key prevents duplicate charges | `app/worker.py:11-15` — Request payload lacks an idempotency key or request ID. If a charge succeeds on the processor but the network timeout causes a retry, the processor receives an identical request with no way to deduplicate, risking double-charging. | Add a unique `idempotency_key` (UUID or deterministic hash of order_id + timestamp) to the request payload. Ensure processor implements idempotent acceptance. |
| 4 | High | Security | Card token sent in plaintext | `app/worker.py:14` — `"card_token": order["card_token"]` is passed in plaintext JSON. If the processor is compromised, logs are exfiltrated, or the response is cached, the token is exposed. | Use TLS client certificate authentication or a request-signing scheme instead of embedding the token. Encrypt the token before transmission or never transmit it directly to the processor. |
| 5 | High | Reliability | Non-2xx HTTP status codes cause infinite retries | `app/worker.py:16` — Response is only accepted if `status_code == 200`. A 4xx client error (invalid card, exceeded limits) or 5xx server error will retry forever instead of failing or escalating. No exponential backoff; constant 0.05s sleep hammers the processor. | Check `response.status_code` and distinguish: 5xx → retry with exponential backoff; 4xx → fail immediately with order details; 2xx → accept. Implement exponential backoff starting at 0.05s, capped at e.g., 30s. |

---

## Unconfirmed Issues

**Request response validation:** `app/worker.py:17` calls `response.json()` without checking response headers or body format. If the processor returns non-JSON (e.g., HTML error page on 500), `.json()` will raise an exception, caught and retried. This is hard to confirm without seeing processor error responses, but testing with a mock would reveal it.

**Hard-coded processor URL not configurable:** `app/worker.py:4` defines `PROCESSOR = "https://cards.example.com/v1/charge"` as a constant. The `PROCESSOR_KEY` setting exists in `app/settings.py:4` but is never imported or used in `worker.py`. Cannot confirm if this is intentional or an oversight without deployment context.

**DATABASE_URL imported but unused:** `app/settings.py:3` imports `DATABASE_URL` from environment, but it is never referenced in `worker.py` or any included code. Unclear if this is dead configuration or if the worker is incomplete.

---

## Summary

### Strengths

- **Retry logic intent is clear:** The README documents idempotency and retry safety as core features, showing awareness of the problem domain.
- **Test structure in place:** A test file exists and imports the module correctly, providing a foundation for expansion.

### Key Risks

The worker has **five high-severity issues that must be resolved before scaling**:

1. **Findings #1 and #5 (Reliability):** The infinite retry loop and non-2xx handling will cause requests to hang or hammer the processor indefinitely on failures. This is a production reliability bomb.
2. **Finding #2 (Observability & Correctness):** Bare exception handling obscures failure modes, making debugging and monitoring impossible. Errors are silent.
3. **Finding #3 (Data Integrity):** Lack of idempotency key creates a duplicate-charge risk in the most critical path (financial transaction).
4. **Finding #4 (Security):** Card tokens in plaintext violate payment security standards (PCI DSS requires encryption in transit and at rest).

Scaling this worker without fixes will:
- Risk financial data exposure (PCI violation).
- Create duplicate-charge liability.
- Cause cascading processor overload on failures (no backoff).
- Hide production errors behind silent exceptions.

### Priority Order

1. **Add max retries + timeout + exponential backoff** (Finding #1, #5) — prevents hangs and processor hammering; highest impact on reliability.
2. **Implement idempotency key** (Finding #3) — prevents double-charging; critical data integrity requirement.
3. **Specific exception handling + logging** (Finding #2) — enables debugging and monitoring; prerequisite for production.
4. **Encrypt card token transmission** (Finding #4) — PCI compliance; required for production payment systems.

### Coverage Gaps

**Not examined:**
- Processor API specification and error response formats (would inform status code handling).
- Production error logs or metrics (would reveal actual failure rates and modes).
- Database schema and payment record storage (DATABASE_URL is imported but never used; unclear if payments are persisted).
- Deployment credentials and TLS certificate setup (would inform encryption recommendations).
- Integration tests with actual processor (pytest only covers module import and settings validation; no retry behavior tested as README claims).
- Load testing or rate-limit handling.
- Concurrent request safety — claims idempotency but provides no distributed lock or version control.

**Tests unavailable:** pytest could not be executed due to environment constraints. The README asserts coverage of "the retry path," but the test file does not contain such tests — only basic module and settings checks visible.

---

**Verified:** 
- All source files read and analyzed.
- Configuration and deployment context documented.
- Five highest-severity findings identified with specific evidence and actionable recommendations.
