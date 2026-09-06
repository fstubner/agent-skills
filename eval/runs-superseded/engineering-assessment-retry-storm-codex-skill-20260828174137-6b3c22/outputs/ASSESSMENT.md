# Payments Worker Engineering Assessment

## Scope and depth

**In scope:** `app/settings.py`, `app/worker.py`, `tests/test_worker.py`,
`ops/deploy.md`, `README.md`, and `pyproject.toml`; payment-attempt correctness,
retry behavior, concurrency, throughput, deployment readiness, tests, and
declared dependencies.

**Out of scope:** external card-processor behavior, database schema and
transaction semantics (no database implementation is present), Kubernetes
manifests/health checks, production metrics, and cloud/network configuration.

**Depth:** targeted review of every in-scope file, plus the declared test
command and available local-tool checks.

## What I ran

| Command | Result |
|---|---|
| `pytest` | Failed to start: `/bin/bash: line 1: pytest: command not found` |
| `python --version` | Failed to start: `/bin/bash: line 1: python: command not found` |
| `command -v ruff`, `command -v mypy`, `command -v pip-audit` | No tools found/output; none are installed or on `PATH`. |

The project declares no build, lint, type-check, or audit scripts in
`pyproject.toml`; the README identifies `pytest` as the test command.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---:|---|---|---|---|---|
| 1 | Critical | Data integrity | Retries are not idempotent, so a successful charge can be submitted again after an ambiguous response or by another replica. | `app/worker.py:9-20` retries the same charge indefinitely without an idempotency key or durable attempt state. `README.md:5` claims the worker is safe on several machines, while `ops/deploy.md:3` deploys three replicas per region. | Send a stable processor idempotency key derived from the order/payment attempt, persist attempt state, and define reconciliation for timeouts and unknown outcomes before running multiple replicas. Add tests for timeout-after-acceptance and concurrent duplicate delivery. |
| 2 | High | Reliability | A processor call has no timeout, and the retry loop has no deadline or attempt limit; one order can occupy a worker forever. | `app/worker.py:11` calls `requests.post` without `timeout`; `app/worker.py:9` uses `while True`; `app/worker.py:20` sleeps and retries forever. | Set connect/read timeouts, bound attempts or elapsed time, classify retryable status/errors, and route exhausted/unknown attempts to durable retry or manual reconciliation. |
| 3 | High | Reliability | Non-success responses and programming/data errors are silently retried forever, hiding permanent failures and creating uncontrolled processor traffic. | `app/worker.py:16-20` returns only for status 200, catches every `Exception`, discards it, and retries all other statuses with a fixed 50 ms delay. | Handle expected transport errors explicitly, use bounded exponential backoff with jitter, treat non-retryable 4xx responses as failures, call `raise_for_status` or inspect response bodies, and emit structured logs/metrics for each terminal outcome. |
| 4 | High | Performance | `run` processes every order serially, so adding replicas is the only concurrency mechanism and each replica still has one in-flight request; the configured batch size is unused. | `app/worker.py:23-27` loops synchronously and calls `charge` inline; `app/settings.py:5` defines `BATCH_SIZE = 500` but no worker code reads it. | Introduce bounded, observable concurrency or a queue consumer with explicit worker limits, use batch-size configuration in the fetch/claim path, and load-test against processor rate limits and database/queue capacity. Preserve per-order idempotency while doing so. |
| 5 | High | Build/deployment | The runtime dependency used by the worker is absent from the project manifest, so a clean deployment can fail at import time. | `app/worker.py:2` imports `requests`; `pyproject.toml` declares `dependencies = []`. The local test command also could not start because `pytest` is unavailable. | Declare and lock the runtime dependency (and test dependencies in a test group), build the deployable artifact in CI, and add a clean-environment smoke test that imports the worker and executes a mocked charge path. |

## Strengths

- The charge payload is explicit and small: `app/worker.py:11-15` sends only
  the order ID, amount, and card token needed by the processor.
- Configuration is at least partly externalized: `app/settings.py:3-4` reads
  database and processor credentials from environment variables, and the
  deployment notes identify a replica count (`ops/deploy.md:3`).

## Key risks

Findings 1–3 can cause duplicate financial charges, indefinite work
occupancy, and noisy repeated requests. Finding 4 means horizontal scaling
does not provide a controlled throughput model, while finding 5 makes the
runtime artifact non-reproducible and potentially non-startable.

## Priority order

1. Establish durable idempotency and reconciliation for ambiguous processor
   outcomes (Finding 1).
2. Add request timeouts and bounded, classified retries (Findings 2–3).
3. Declare/lock dependencies and add a clean-environment smoke check (Finding
   5).
4. Design bounded concurrency and make batch sizing operational, then load
   test it (Finding 4).

## Coverage gaps

- No database, queue, schema, migration, Kubernetes manifest, CI pipeline, or
  production configuration was present in the enumerated workspace.
- The processor API contract was unavailable, so status-code retryability,
  idempotency-key support, and whether `200` is the only success response
  require confirmation.
- Tests, linting, type checking, dependency auditing, build/package creation,
  and load testing could not be completed because the corresponding tools or
  commands were unavailable; `pytest` specifically failed to start.
- No penetration test, failure-injection test, multi-replica concurrency test,
  or production observability/metrics review was performed.
- The default processor key in `app/settings.py:4` was observed, but its
  security impact is unconfirmed because this worker never imports or uses
  `settings.PROCESSOR_KEY`; deployment secret injection was not available to
  inspect.

