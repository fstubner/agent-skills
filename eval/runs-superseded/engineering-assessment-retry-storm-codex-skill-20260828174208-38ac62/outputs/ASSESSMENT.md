# Payments Worker Engineering Assessment

## Scope and depth

**In scope:** `app/settings.py`, `app/worker.py`, `tests/test_worker.py`, `ops/deploy.md`, `pyproject.toml`, and `README.md`; worker correctness, payment safety, reliability, scalability, and deployment reproducibility.

**Depth:** targeted — every in-scope file was read in full, and available checks were attempted.

**Out of scope:** production infrastructure manifests, database schema/migrations, processor contract/SLA, observability and alerting configuration, CI configuration, and runtime/load or penetration testing; none are present in the workspace.

## What I ran

- `pytest` — **failed to start**, `/bin/bash: pytest: command not found` (exit 127).
- `python -m compileall -q app tests` — **failed to start**, `/bin/bash: python: command not found` (exit 127).
- `python3 -m compileall -q app tests` — **passed**, `compileall_exit=0`.
- `DATABASE_URL=sqlite:///tmp PROCESSOR_KEY= python3 - <<'PY' ... import app.worker ... PY` — **failed**, `ModuleNotFoundError: No module named 'requests'`.

No build, lint, type-check, dependency-audit, or project-specific checker is declared in `pyproject.toml`; those checks were not attempted because no configuration or tool invocation is provided.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | A production deployment silently uses a built-in processor credential when `PROCESSOR_KEY` is absent. | `app/settings.py:4` — `os.environ.get("PROCESSOR_KEY", "local-dev-processor-key")`. The fallback is a usable-looking key, and `app/worker.py` sends payment requests to the processor path. | Remove the fallback and fail startup unless a secret is explicitly supplied. Source the secret from the deployment secret manager, rotate any credential that has used this default, and ensure the request authenticates with `PROCESSOR_KEY` through the processor’s required mechanism. |
| 2 | High | Reliability / Data integrity | `charge` can retry forever, with no request timeout or retry limit, so a hung processor or persistent 4xx/5xx response permanently occupies a worker and prevents later orders from being processed. | `app/worker.py:9-20` — unconditional `while True`; `requests.post(...)` has no `timeout`; every non-200 response falls through to `sleep` and retry; all exceptions are swallowed. `run` processes the next order only after `charge` returns (`app/worker.py:23-26`). | Set a finite connect/read timeout, classify retryable versus permanent responses, use bounded exponential backoff with jitter and a maximum attempt/dead-letter outcome, and surface structured errors/metrics. |
| 3 | Critical | Data integrity | The implementation does not provide the idempotency guarantee claimed by the README; a timeout after the processor accepts a charge causes the same order to be submitted again. | `README.md:3-5` claims the worker is idempotent. `app/worker.py:11-15` posts only order/payment fields and has no idempotency key or durable claim/result check; `app/worker.py:18-20` retries after any exception, including an ambiguous network failure. | Send a stable per-order idempotency key supported by the processor and persist/transactionally enforce charge state before and after submission. Treat ambiguous outcomes as reconciliation work, not an unconditional second charge. |
| 4 | High | Scalability / Performance | Orders are charged strictly serially, so adding replicas is the only concurrency mechanism and a single slow order stalls all subsequent orders on that replica; the configured batch size is unused. | `app/worker.py:23-26` loops over `orders` and calls `charge` synchronously. `app/settings.py:5` defines `BATCH_SIZE = 500`, but no application code reads it. `ops/deploy.md:3` states only that three replicas run per region. | Introduce bounded, explicitly controlled concurrency with per-order isolation and backpressure, use `BATCH_SIZE` in the fetch/dispatch boundary, and measure processor limits before selecting worker and replica counts. Preserve idempotent claims when multiple replicas operate concurrently. |
| 5 | High | Deployment / Reliability | The declared package is not runnable from a clean environment because the worker imports undeclared `requests`; deployment can succeed while the process fails at import time. | `pyproject.toml:1-8` declares `dependencies = []`; `app/worker.py:2` imports `requests`. The verification command failed with `ModuleNotFoundError: No module named 'requests'`. | Declare and pin the runtime dependency (and lock it in the deployment build), build the image/environment from that manifest, and add a clean-environment startup/import check to CI. |

## Strengths

- Configuration is at least centralized in `app/settings.py`, and the worker’s externally configurable database URL is required at import time (`app/settings.py:3`), which exposes missing configuration early.
- The code is small and syntactically valid: `python3 -m compileall -q app tests` passed. The two existing tests also keep a basic module/batch-size contract visible, although they could not be run here.

## Key risks

Findings 1 and 3 can cause credential exposure or duplicate customer charges. Findings 2 and 4 can strand capacity and make scaling ineffective. Finding 5 prevents reproducible startup before runtime behavior can be exercised.

## Priority order

1. Remove the credential fallback, rotate affected credentials, and define the processor authentication path.
2. Add processor idempotency plus durable order/charge state and reconciliation for ambiguous outcomes.
3. Bound retries and add request timeouts, retry classification, and operational visibility.
4. Fix the dependency manifest and make clean-environment startup part of CI/deployment.
5. Design and load-test bounded concurrency and batch consumption against processor rate limits.

## Coverage gaps

- No production deployment manifests, database schema/state model, queue/claim implementation, secret-manager configuration, CI pipeline, logs/metrics/traces, or processor API contract were available.
- `pytest` could not run because it is not installed; therefore test behavior and coverage are unverified.
- `python -m compileall` could not run because `python` is not installed; the equivalent `python3` check passed.
- No build, lint, type-check, dependency audit, load test, failure-injection test, integration test against the processor, or penetration test was performed.
- The report does not confirm whether the default processor key is accepted in any environment; the critical rating reflects the concrete plaintext fallback and the payment-processing path, while actual credential exposure requires deployment/configuration verification.
