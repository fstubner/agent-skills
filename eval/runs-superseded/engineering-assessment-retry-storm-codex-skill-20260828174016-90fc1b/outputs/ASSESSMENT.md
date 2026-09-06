# Payments Worker Engineering Assessment

## Scope and context

In scope: `pyproject.toml`, `README.md`, `ops/deploy.md`, `app/settings.py`,
`app/worker.py`, and `tests/test_worker.py`. The repository is a Python 3.11+
payments worker that calls an external card processor; deployment runs three
Kubernetes replicas per region. Depth: **targeted** for the application files
and deployment documentation, with available project checks attempted.

## What I ran

- `pytest -q` — could not start: `/bin/bash: pytest: command not found`.
- `ruff check .` — could not start: `/bin/bash: ruff: command not found`.
- `mypy .` — could not start: `/bin/bash: mypy: command not found`.
- `python --version`, `python -m compileall -q app tests`, and the import probe
  — could not start: `python: command not found`.
- `python3 --version` — `Python 3.12.3`.
- `python3 -m compileall -q app tests` — passed with no output.
- `DATABASE_URL=... python3` import probe — failed with
  `ModuleNotFoundError: No module named 'requests'`.
- `python3 -m pytest -q` — could not start: `/usr/bin/python3: No module
  named pytest`.

No project-declared build, lint, or test scripts are present in `pyproject.toml`.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | A processor response lost after the charge can cause a duplicate charge. | `app/worker.py:9-20` retries the same `order_id` indefinitely, but the request contains no processor idempotency key and retries after any exception, including a connection failure after the processor accepted the charge. | Send a stable idempotency key per order/attempt to the processor and persist/reconcile charge state before retrying; add an integration test for “charge succeeded, response was lost.” |
| 2 | High | Reliability | A processor outage can pin a worker forever and prevent shutdown or progress on later orders. | `app/worker.py:9-20` uses `while True`, catches every exception, has no retry limit/dead-letter path, and calls `requests.post` without a timeout. | Set connect/read timeouts, use bounded exponential backoff with jitter, classify retryable responses, and move exhausted orders to an explicit retry queue/DLQ with operational alerts. |
| 3 | High | Performance | Work is strictly serial, so one slow or unavailable order blocks the entire batch and all available worker capacity. | `app/worker.py:23-27` calls `charge(order)` synchronously for each order; `ops/deploy.md:3` says only three replicas run per region. | Introduce controlled concurrency with a bounded worker pool and rate limit, while preserving per-order idempotency and backpressure; measure processor limits before selecting the parallelism. |
| 4 | High | Reliability / correctness | Broad exception swallowing converts malformed orders, processor response parsing bugs, and programming errors into an endless retry loop with no diagnosis. | `app/worker.py:11-20` catches bare `Exception`, discards it with `pass`, and retries even when `response.json()` at line 17 raises or required order keys are missing at lines 12-14. | Catch and classify specific transport/HTTP errors, validate orders before submission, record structured error context, and fail or quarantine non-retryable work. |
| 5 | High | Security / configuration | The application has an insecure fallback processor credential and does not demonstrate that its configured secrets or database are used safely. | `app/settings.py:3-4` requires `DATABASE_URL` but defaults `PROCESSOR_KEY` to the literal `local-dev-processor-key`; `app/worker.py:4-15` never imports settings or sends `PROCESSOR_KEY`, so the configured credential is unused while card-token data is sent to a hard-coded endpoint. | Make the processor credential mandatory outside an explicitly isolated test mode, inject it into an authenticated client, validate the endpoint by environment, and document/verify secret handling and TLS policy. Remove or separately audit unneeded card data and configuration paths. |

## Strengths

- The request uses JSON fields rather than constructing a URL or query string
  from order data (`app/worker.py:11-15`), reducing one class of injection risk.
- `BATCH_SIZE` is externalized as a named setting and is at least covered by a
  basic positivity test (`app/settings.py:5`, `tests/test_worker.py:8-10`).
- The code is small and syntax-compilable: `python3 -m compileall -q app tests`
  completed successfully.

## Key risks

Findings 1 and 2 make payment correctness and worker liveness unsafe during
the exact processor failures the README promises to tolerate. Findings 3 and
4 then amplify operational impact under scale and obscure the cause. Finding 5
needs resolution before production credentials and endpoint behavior are
trusted.

## Priority order

1. Establish durable charge state and processor idempotency (Finding 1).
2. Add timeouts, bounded/classified retries, quarantine, and alerting (Findings
   2 and 4).
3. Make credentials mandatory and wire a verified authenticated client/config
   path (Finding 5).
4. Load-test and implement bounded concurrency with backpressure (Finding 3).

## Coverage gaps

- Tests, lint, and type checking could not execute because `pytest`, `ruff`,
  `mypy`, and the `requests` runtime dependency are unavailable in this
  environment.
- No live processor, database, Kubernetes manifests, CI configuration,
  observability, queue, or secret-manager configuration was present in the
  enumerated repository, so those integrations were not verified.
- No load, failure-injection, penetration, payment-reconciliation, or
  concurrency testing was performed.
- The actual processor contract (idempotency semantics, authentication,
  retryable status codes) and production metrics were unavailable.

## Unconfirmed / Requires Investigation

- Whether the processor independently deduplicates `order_id` is unknown; if
  it does, Finding 1's duplicate-charge impact may be reduced, but the worker
  still does not explicitly rely on or verify that contract.
- Whether deployment injects `PROCESSOR_KEY` through an external client wrapper
  is unknown; the checked worker does not consume the setting directly.
