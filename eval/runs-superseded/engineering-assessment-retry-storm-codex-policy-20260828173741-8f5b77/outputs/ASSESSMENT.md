# Payments worker assessment

Scope: `app/worker.py`, `app/settings.py`, `tests/test_worker.py`, `ops/deploy.md`, and `README.md`. Findings are ordered by likely payment or availability impact.

## 1. Retries can create duplicate charges (critical)

`charge()` retries after every non-200 response and every exception, but the request does not include an idempotency key and there is no durable charge state (`app/worker.py:9-20`). A timeout or connection failure can occur after the processor has accepted the charge; the next attempt can then bill the customer again. Running three replicas (`ops/deploy.md:3`) makes concurrent duplicate attempts more likely, and the README's claim that the worker is idempotent is not supported by the implementation.

Before scaling, make the processor request idempotent using a stable per-order/payment-attempt key, persist the payment state, and define reconciliation behavior for ambiguous outcomes. Add tests for “accepted remotely, response lost” and concurrent workers.

## 2. No request timeout or bounded retry policy can exhaust workers (high)

`requests.post()` has no `timeout` (`app/worker.py:11`). One connection can block a worker indefinitely; if it does return, the unbounded loop and 50 ms retry delay (`app/worker.py:9,20`) can continue forever. This prevents batch completion, creates uncontrolled processor load during an outage, and provides no dead-letter or operator-visible terminal state.

Use explicit connect/read timeouts, bounded retries with exponential backoff and jitter, retry only classified transient failures, and persist/emit a terminal failure for later retry or reconciliation.

## 3. Processor credentials are not applied, and a usable default is shipped (high)

`PROCESSOR_KEY` is read with a fallback value (`app/settings.py:4`) but is never passed to the processor request (`app/worker.py:11-15`). In production this can cause all requests to be unauthorized or unauthenticated. The fallback also permits accidental deployment with a known credential-like value. `DATABASE_URL` is required at import time (`app/settings.py:3`), yet this worker does not use a database at all, so the apparent persistence dependency does not provide payment safety.

Require the processor credential in production, send it through the processor's supported authentication mechanism, reject unsafe defaults, and either implement the intended durable store or remove the misleading configuration. Test missing/invalid credentials and request authentication.

## 4. Inputs and authorization are not validated at the trust boundary (high)

The worker directly indexes `id`, `amount_cents`, and `card_token` and forwards them to the external processor (`app/worker.py:11-15`). There is no type/range/currency validation, token/provider validation, authorization check, or protection against a caller changing the amount or charging an order outside its authority. Malformed or unauthorized work can become real payment attempts.

Validate a typed payment command at ingestion, load authoritative amount/ownership from trusted order data, authorize the operation, and avoid logging or otherwise exposing card tokens. Add focused rejection and authorization tests, including negative/overflow amounts and mismatched order data.

## 5. Batch processing is non-durable and strictly serial (high)

`run()` charges one order at a time and stores results only in an in-memory list (`app/worker.py:23-27`). A crash, rollout, or pod eviction loses progress; restarting can replay completed orders (especially dangerous given finding 1). At 500 orders (`app/settings.py:5`), one stuck order also blocks every later order, while adding replicas does not coordinate ownership or provide exactly-once effects.

Use a durable queue or database-backed work states with leases/visibility timeouts, atomic claim/ack semantics, and resumable per-order results. Parallelize only with bounded concurrency and processor rate limits, and test crash/restart, lease expiry, and duplicate delivery behavior.

## Verification and remaining uncertainty

Static review covered all six repository files present in the workspace. `pytest -q` and Python compilation could not be run because neither `pytest` nor `python` is installed in the environment (both exited 127). The processor's authentication, idempotency, rate-limit, and error-contract details are unknown and must be confirmed against its documentation before implementation.
