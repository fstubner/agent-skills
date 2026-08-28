# Payments worker assessment

## Scope and context

Depth: targeted. In scope: `app/settings.py`, `app/worker.py`,
`tests/test_worker.py`, `ops/deploy.md`, `README.md`, and `pyproject.toml`.
This is a Python 3.11+ payments worker that calls an external card processor;
deployment runs three Kubernetes replicas per region.

## What I ran

- `pytest -q` — could not start: `/bin/bash: pytest: command not found`.
- `python -m compileall -q app tests` — could not start: `python: command not found`.
- `ruff check .` — could not start: `ruff: command not found`.
- `mypy app` — could not start: `mypy: command not found`.
- `python -m build` — could not start: `python: command not found`.
- `python3 -m compileall -q app tests` — passed, exit 0.
- `python3 -c 'import app.worker; print("import ok")'` — failed, exit 1:
  `ModuleNotFoundError: No module named 'requests'`.
- A `tomllib` inspection of `pyproject.toml` reported
  `project.scripts=None` and `dependencies=[]`.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | A usable default processor credential is supplied when the environment variable is absent. | `app/settings.py:4` sets `PROCESSOR_KEY` to `"local-dev-processor-key"`; the worker is deployed to three replicas per region per `ops/deploy.md:3`. | Fail startup when `PROCESSOR_KEY` is missing; source it from the deployment secret manager and validate that production configuration cannot use a development value. |
| 2 | High | Reliability | A processor outage or persistent non-200 response can pin a worker forever, and the HTTP request itself has no timeout. | `app/worker.py:9-20` loops forever, catches every `Exception`, retries every status other than 200, and calls `requests.post` without `timeout`. | Set connect/read timeouts, classify retryable errors/statuses, use bounded exponential backoff with jitter, and route exhausted attempts to durable retry/dead-letter handling. |
| 3 | High | Data integrity | Retries of the non-idempotent charge request can create duplicate charges; the claimed idempotency is not implemented in the request. | `app/worker.py:11-15` repeats the same POST but sends only `order_id`, amount, and card token—no processor idempotency key or pre/post-charge reconciliation; `README.md:5` claims the worker is idempotent. | Send a stable per-order idempotency key accepted and enforced by the processor, persist charge state durably, and reconcile ambiguous timeout responses before issuing another charge. |
| 4 | High | Performance | `run` processes all orders strictly serially, so throughput is capped at one request at a time and a stuck order blocks the whole batch. | `app/worker.py:23-27` calls `charge(order)` synchronously inside the loop; `charge` may never return under finding 2. | Use bounded concurrency with a shared, configured worker pool; isolate failures per order and apply backpressure/rate limits that match processor capacity. |
| 5 | High | Build/release reliability | The declared package cannot install its runtime dependency, so a clean deployment fails at import time. | `pyproject.toml:10-11` declares `dependencies=[]`, while `app/worker.py:2` imports `requests`; direct `python3` import failed with `ModuleNotFoundError: No module named 'requests'`. | Declare and pin the supported `requests` dependency (or replace it with an explicitly packaged standard client), build the deployment artifact in CI, and run an import/startup smoke test. |

## Strengths

- The processor endpoint is HTTPS and the charge payload is passed as structured
  JSON (`app/worker.py:4,11-15`), avoiding URL construction for payment fields.
- Configuration is at least partially externalized through environment
  variables (`app/settings.py:3-4`), and batch size is named rather than buried
  in the processing loop (`app/settings.py:5`).

## Key risks

Findings 1 and 3 can directly expose credentials or create duplicate customer
charges. Findings 2 and 4 can halt revenue processing during a processor
incident. Finding 5 means the release artifact is not reproducibly runnable.

## Priority order

1. Remove the default credential and enforce secret-backed production startup.
2. Add request timeouts, bounded retry policy, and durable retry handling.
3. Implement processor-backed idempotency and ambiguous-outcome reconciliation.
4. Package the runtime dependency and add a clean-environment smoke test.
5. Introduce bounded concurrency with processor-aware rate limiting.

## Coverage gaps

- `pytest`, `ruff`, `mypy`, and the declared `python -m build` command could not
  run because those executables were unavailable; test, lint, type, and package
  results therefore remain unverified.
- No load, fault-injection, concurrency, penetration, or processor contract
  testing was performed.
- No database, queue, Kubernetes manifests, secret-manager configuration,
  CI/CD pipeline, observability, or rollback implementation was present in the
  enumerated workspace, so those production controls were not examined.
- The assessment did not inspect external processor behavior, deployment
  credentials, production metrics, or runtime dependency images.

