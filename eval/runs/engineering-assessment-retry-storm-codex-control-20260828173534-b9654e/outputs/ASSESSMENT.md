# Payments worker assessment

Scope: `app/worker.py`, `app/settings.py`, `pyproject.toml`, deployment notes, and the included tests. Findings are ordered by risk and scaling impact.

## 1. Charges are not idempotent (Critical)

`charge()` sends `order_id`, amount, and card token, but no processor idempotency key or persisted charge state. If the processor accepts a charge and the response is lost, the worker retries and can create a second charge. Three replicas also make concurrent duplicate charges possible. The README claim that the worker is idempotent and safe to run on several machines is therefore not supported.

Require a stable idempotency key derived from the payment attempt/order and use the processor's idempotency/reconciliation API. Persist an authoritative attempt state and treat ambiguous outcomes as reconciliation work, not as permission to blindly charge again.

## 2. The retry loop can run forever and has no backoff policy (Critical)

`charge()` loops indefinitely, swallows every exception, retries every non-200 response, and sleeps a fixed 50 ms. A sustained outage or a permanent request error will pin a worker forever; at scale this can exhaust worker slots and generate a processor retry storm. There is no deadline, attempt budget, jitter, circuit breaker, dead-letter path, or alertable failure state.

Introduce bounded, jittered retries with an overall deadline, classify retryable failures explicitly, and hand off exhausted/ambiguous attempts for durable retry or manual reconciliation. Emit structured logs and metrics for attempts, outcomes, and exhaustion.

## 3. HTTP requests have no timeout (High)

`requests.post(...)` supplies neither connect nor read timeout. A connection or response can block indefinitely before the retry loop gets control, so the “retry” behavior does not provide a usable liveness bound and can strand all available workers.

Set explicit connect/read (and, where applicable, total) timeouts, size connection pools for the intended concurrency, and test timeout handling separately from processor HTTP errors.

## 4. Processor authentication is configured but never used (High)

`PROCESSOR_KEY` is loaded in `app/settings.py`, while `worker.py` neither imports it nor sends an authorization header. Deployments can therefore omit authentication or fail every request, depending on processor policy. The default value `local-dev-processor-key` also makes accidental production misconfiguration easy.

Use the configured secret through the processor's required auth mechanism, fail closed when it is absent, and remove the production-unsafe default. Add a configuration test that verifies the request is authenticated without logging the secret.

## 5. Work is sequential and progress is only in memory (High)

`run()` charges one order at a time and accumulates results in a local list. `BATCH_SIZE` is not used, and there is no durable claim/ack/checkpoint mechanism. A slow order or process termination stalls the whole batch; a crash loses knowledge of completed work, encouraging replays (which are unsafe given finding 1). Three replicas do not provide safe parallel processing by themselves.

Use a durable queue or database-backed work claims with leases, acknowledgements, and recovery. Bound batch size, add controlled concurrency subject to processor limits, and persist each attempt/result so restarts and horizontal scaling are coordinated.

## Verification

Inspected all application, configuration, deployment, packaging, and test files present in the workspace. The included tests were not run because `pytest` is not installed in the environment.
