# Payments Worker Engineering Assessment

## Scope and depth

**Depth:** targeted. I enumerated and read every file in the application scope:

| Directory | Files |
|---|---|
| `app/` | `app/settings.py`, `app/worker.py` |
| `tests/` | `tests/test_worker.py` |
| `ops/` | `ops/deploy.md` |
| repository root | `README.md`, `pyproject.toml` |

**In scope:** charge execution, retry and idempotency behavior, batch execution,
configuration/dependencies, tests, and deployment notes. **Out of scope:**
production infrastructure and processor-side behavior, because no manifests,
service implementation, database schema, or deployment configuration was
provided.

## What I ran

| Command | Result |
|---|---|
| `pytest -q` | Failed to start: `/bin/bash: line 1: pytest: command not found` (exit 127). |
| `python -m compileall -q app tests` | Failed to start: `/bin/bash: line 1: python: command not found` (exit 127). |
| `ruff`, `mypy`, `bandit`, `pip-audit` availability checks | None was available; no static or dependency audit was run. |

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---:|---|---|---|---|---|
| 1 | Critical | Data integrity | A retried charge has no idempotency key, so a timeout or lost response can create duplicate card charges. | `app/worker.py:11-15` posts the same order repeatedly but sends only `order_id`, amount, and card token; `app/worker.py:9-20` retries after any exception, including an ambiguous processor result. | Send a stable processor-supported idempotency key derived from the order/payment attempt, persist the attempt state, and reconcile ambiguous outcomes before retrying. Add a test for a charge accepted before the response is lost. |
| 2 | High | Reliability | `charge` can loop forever and prevent the batch from completing. | `app/worker.py:9` uses `while True`; all exceptions are swallowed at `:18-19`, and every non-200 response falls through to another attempt at `:16-20`. There is no attempt limit, deadline, circuit breaker, or shutdown handling. | Bound retries with a deadline/attempt policy, classify retryable versus permanent responses, propagate terminal failure, and expose metrics/alerts for exhausted or stuck attempts. |
| 3 | High | Reliability / performance | Processor requests have no timeout, allowing workers to consume a connection/thread indefinitely and making the 50 ms retry delay ineffective. | `app/worker.py:11` calls `requests.post(...)` without `timeout`; `app/worker.py:20` sleeps only after the call returns or raises. | Set explicit connect/read timeouts, use bounded exponential backoff with jitter, and test slow, hung, and unavailable processor behavior. |
| 4 | High | Correctness / operations | The implementation does not provide the claimed multi-machine-safe work coordination, and `run` processes all orders serially. Multiple replicas can charge the same input, while one slow order blocks the rest. | `README.md:3-5` claims idempotency and safe concurrent execution; `app/worker.py:23-27` iterates the supplied list with no claim/lease/locking or deduplication; `ops/deploy.md:3` deploys three replicas per region. | Add an authoritative durable work-claim/lease mechanism and unique payment-attempt constraint, then deliberately control concurrency with bounded parallelism and backpressure. Validate the design with multi-replica tests. |
| 5 | High | Build / deployment security | The declared package metadata omits the runtime dependency imported by the worker, and configuration contains a production-usable default processor key. | `app/worker.py:2` imports `requests`, while `pyproject.toml:12` declares `dependencies = []`; `app/settings.py:4` defaults `PROCESSOR_KEY` to `local-dev-processor-key`. | Declare and pin the runtime dependency in the deployment artifact and fail startup when a production secret is absent; remove the credential fallback and ensure the key is actually passed through the authenticated processor client. |

## Strengths

- The charge payload is explicit and small (`app/worker.py:11-15`), which makes
  processor integration and request-level testing straightforward.
- Configuration is centralized in `app/settings.py`, and a positive batch-size
  sanity test exists in `tests/test_worker.py:8-10`.

## Key risks

Findings 1–4 can cause duplicate revenue collection, stuck workers, and poor
throughput as replicas and order volume increase. Finding 5 can make a fresh
deployment fail at import time and permits insecure secret configuration.

## Priority order

1. Implement durable payment-attempt idempotency and ambiguous-result
   reconciliation (Finding 1).
2. Add request deadlines and bounded, classified retries (Findings 2–3).
3. Design durable multi-replica work claiming and bounded concurrency (Finding 4).
4. Fix packaging and enforce production secret requirements (Finding 5).
5. Restore the test environment and add failure-mode, duplicate-charge, and
   multi-replica tests before scaling.

## Unconfirmed / requires investigation

- The processor’s idempotency and authentication contract was not available, so
  the exact supported header/key format must be confirmed with its API owner.
- Whether an external queue or database already deduplicates and leases orders
  could not be verified; no such integration appears in the supplied worker,
  but production configuration was out of scope.

## Coverage gaps

- No production metrics, logs, queue/database schema, Kubernetes manifests,
  secret configuration, processor API documentation, or rollback automation was
  available.
- Tests, compilation, linting, type checking, security scanning, and dependency
  auditing could not be executed because the corresponding tools/interpreter
  were unavailable; the only declared test command, `pytest`, failed to start.
- No load, fault-injection, integration, penetration, or multi-replica testing
  was performed.
