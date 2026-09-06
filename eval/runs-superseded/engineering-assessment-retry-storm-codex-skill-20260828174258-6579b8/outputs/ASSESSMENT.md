# Payments Worker Engineering Assessment

## Scope and depth

**In scope:** `pyproject.toml`, `README.md`, `app/settings.py`, `app/worker.py`, `tests/test_worker.py`, and `ops/deploy.md`; payment retry behavior, concurrency/idempotency, runtime dependencies, configuration, tests, and deployment operations.

**Depth:** targeted. Every in-scope file was read in full, and the available checks were attempted before findings were written.

**Out of scope:** external card-processor behavior/API guarantees, infrastructure manifests and runtime environment outside this workspace, database schema/transaction behavior (no database code is present), production telemetry, and live load/security testing.

## What I ran

- `pytest -q` — failed to start: `/bin/bash: line 1: pytest: command not found`.
- `python -m compileall -q app tests` — failed to start: `/bin/bash: line 1: python: command not found`.
- `ruff check .` — failed to start: `/bin/bash: line 1: ruff: command not found`.
- `python3 -m compileall -q app tests` — passed (`compileall_exit=0`).
- `python3 -m unittest discover -v` — ran zero tests and exited 5 (`NO TESTS RAN`). The tests are pytest-style functions, not unittest cases.
- `DATABASE_URL=sqlite:///tmp PROCESSOR_KEY=test-key python3 -c 'import app.worker'` — failed: `ModuleNotFoundError: No module named 'requests'`.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | A retry can charge the same order more than once. | `app/worker.py:9-20` retries after every exception and every non-200 response, but `app/worker.py:11-15` sends no idempotency key. A timeout or lost response can occur after the processor accepted the charge, causing the next POST to create another charge. | Use the processor’s idempotency-key mechanism with a stable per-order key, persist charge state, and reconcile ambiguous outcomes before retrying. Add a test for “accepted remotely, response lost.” |
| 2 | High | Reliability | Requests and the worker have no bounded timeout or retry limit, so one problematic order can hang a worker forever. | `app/worker.py:11` calls `requests.post` without `timeout`; `app/worker.py:9` uses `while True`; `app/worker.py:20` sleeps and retries indefinitely. `run` cannot advance past that order (`app/worker.py:23-27`). | Set connect/read timeouts, use bounded exponential backoff with jitter and a retry budget/dead-letter path, and expose failure metrics/alerts. |
| 3 | High | Reliability | All failures are swallowed and treated as transient, including permanent input/programming errors. | `app/worker.py:11-19` catches `Exception`, ignores the response body/status, and also retries exceptions such as missing order keys or JSON/serialization errors. | Catch transport and explicitly retryable processor errors only; validate orders before charging; record structured error context and terminate or quarantine non-retryable failures. |
| 4 | High | Operability / deployment | The deployed application cannot import its required HTTP client from the declared package metadata. | `pyproject.toml:1-13` declares `dependencies = []`, while `app/worker.py:2` imports `requests`; the import check failed with `ModuleNotFoundError: No module named 'requests'`. | Declare and pin the runtime dependency, build the deployment artifact from that manifest, and make CI fail if a clean-environment import/startup check fails. |
| 5 | High | Performance / scalability | Processing is strictly serial and ignores the configured batch size, limiting throughput as volume grows. | `app/settings.py:5` defines `BATCH_SIZE = 500`, but `app/worker.py:23-27` loops one order at a time and never references `BATCH_SIZE`; `ops/deploy.md:3` describes three replicas but provides no partitioning/coordination scheme. | Design bounded parallelism with connection pooling and explicit queue partition/claim semantics; use `BATCH_SIZE` or remove it, and ensure each order is claimed exactly once across replicas. Load-test against processor rate limits before scaling replicas. |

## Strengths

- The worker separates per-order charging (`charge`) from collection orchestration (`run`), keeping the main control flow small (`app/worker.py:7-27`).
- The repository has a basic test for module availability and positive batch configuration (`tests/test_worker.py:4-10`), and the source compiles successfully with Python 3 (`python3 -m compileall -q app tests`).

## Key Risks

Findings 1–3 can cause duplicate financial charges, indefinite worker occupation, and silent loss of actionable failure information. Finding 4 is an immediate deployment/startup risk. Finding 5 means adding replicas alone does not provide controlled or predictable scale-out.

## Priority Order

1. Add stable payment idempotency and reconciliation for ambiguous processor outcomes (Finding 1).
2. Bound request/retry behavior and separate retryable from permanent failures (Findings 2–3).
3. Fix and verify the runtime dependency in the build artifact (Finding 4).
4. Implement bounded parallelism and distributed order-claiming, then load-test (Finding 5).

## Unconfirmed / Requires Investigation

- Whether `cards.example.com` deduplicates requests by `order_id` despite the absence of an explicit idempotency key is unknown; processor documentation or a controlled test is required. The duplicate-charge risk remains because no such guarantee is represented in this code.
- The expected semantics of non-200 responses, retryable status codes, and charge reconciliation are unavailable because the processor contract is not in the workspace.

## Coverage Gaps

- `pytest`, `ruff`, and the `python` command were unavailable; therefore the declared tests and lint checks did not run. `unittest` found no tests because the suite uses pytest-style functions.
- No build command is declared in `pyproject.toml`; no package/build artifact was produced.
- No integration, processor-sandbox, database, concurrency, load, failure-injection, penetration, or deployment smoke testing was performed.
- No CI configuration, container image, Kubernetes manifests, queue/database implementation, production metrics, or rollback automation was present in the six-file workspace inventory.
