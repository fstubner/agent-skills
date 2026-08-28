# Payments worker assessment

Scope: `app/worker.py`, `app/settings.py`, `tests/test_worker.py`, `README.md`, `ops/deploy.md`, and `pyproject.toml`.

## 1. Critical — retries can create duplicate charges

`charge()` retries the same POST after every exception and every non-200 response, but sends no idempotency key. A timeout or connection reset can happen after the processor has accepted the charge; the next attempt can therefore charge the customer again. The README’s claim that the worker is idempotent is not supported by the implementation. Use a stable per-order/payment-attempt idempotency key, persist the attempt and processor result, and reconcile ambiguous outcomes before retrying.

## 2. High — an outage can wedge workers indefinitely

The loop has no termination, deadline, retry budget, backoff, jitter, circuit breaker, or handling for retryable versus permanent processor responses. `requests.post()` also has no connect/read timeout. One bad order can hold a worker forever, and three replicas per region can continuously hammer a degraded processor. Add bounded, classified retries with timeouts, backoff/jitter, cancellation, alerting, and a durable dead-letter/manual-reconciliation path.

## 3. High — processor authentication is configured but never used

`PROCESSOR_KEY` is read in `app/settings.py`, while `worker.py` sends no authorization header or other credential to `PROCESSOR`. In addition, the default value is a real-looking development key, which risks accidental insecure deployment. Authenticate requests using the configured secret, fail closed when it is absent, and ensure secrets are supplied through the deployment secret mechanism and never logged.

## 4. High — orders/results exist only in process memory and are not safely claimed

`run()` consumes an iterable and accumulates results in a local list; there is no durable receipt, status transition, lease, acknowledgment, or recovery protocol. A crash loses in-flight progress, while rerunning or running on multiple machines can process the same order (especially given the missing idempotency key). Define an atomic database-backed claim/state machine with leases and reconciliation, using additive schema changes compatible with rolling deploys.

## 5. Medium — the stated scale-up path is serial and lacks deployment safety

`run()` charges orders strictly one at a time, so `BATCH_SIZE = 500` does not provide batching or controlled parallelism; throughput is bounded by processor latency and a stuck order blocks the batch. Meanwhile deployment documentation provides only `kubectl set image`, with three replicas and no rollback or drain procedure. Add bounded concurrency with processor/rate limits, graceful shutdown and health checks, then document reversible rollout/rollback and verify duplicate and failure behavior under multiple replicas.

## Verification and uncertainty

I inspected all application, test, configuration, README, deployment, and project metadata files present in the workspace. Static compilation/import checks could not be run because `python` is unavailable in the environment; `pytest` is also unavailable, so the existing tests were not executed. No application files were changed.
