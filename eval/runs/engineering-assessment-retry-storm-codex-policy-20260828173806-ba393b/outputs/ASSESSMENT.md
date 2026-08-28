# Payments worker assessment

Scope: `app/worker.py`, `app/settings.py`, tests, packaging metadata, and deployment notes. The five findings below are ordered by expected payment-loss, customer-impact, or scale risk.

## 1. Retries can create duplicate charges (Critical)

`charge()` retries the same request without an idempotency key. If the processor accepts a charge but the response is lost or the client times out, the next request can charge the card again. The same issue occurs when two workers receive the same order; `run()` has no claim, lease, or database-backed state transition despite the README claiming the worker is safe on several machines.

Before scaling, send a stable processor idempotency key derived from the order/payment attempt and persist an authoritative charge state. Define how retries and reconciliation handle an “accepted but unknown” outcome. Add tests for lost responses and concurrent delivery.

## 2. Retry loop is unbounded, unclassified, and has no request timeout (Critical)

Every non-`200` response and every exception is swallowed, followed by a fixed 50 ms sleep forever. A processor outage, invalid request, declined card, authentication failure, or permanent 4xx can pin a worker indefinitely. Requests has no timeout here, so one network call can itself block indefinitely. At scale this creates retry storms, exhausts worker capacity, and prevents orderly shutdown.

Use explicit connect/read timeouts, classify retryable versus terminal responses, use bounded exponential backoff with jitter and a retry budget/dead-letter path, and honor cancellation. Record the terminal reason and attempt count.

## 3. Processor authentication is misconfigured and the secret is unused (High)

`PROCESSOR_KEY` is loaded in `app/settings.py`, but `worker.py` never imports or sends it. The fallback value `local-dev-processor-key` is also unsafe if production starts without the environment variable. In practice, requests may be rejected forever by the processor, while the worker gives no diagnostic because all failures are discarded.

Make the credential mandatory in production, pass it through the processor’s documented authentication mechanism, and fail fast on missing/invalid configuration. Keep credentials out of logs and add a configuration/authentication test.

## 4. Processing is sequential and has no durable work/commit protocol (High)

`run()` charges orders one at a time and only accumulates an in-memory `results` list. `BATCH_SIZE` is not used, and `DATABASE_URL` is only read at import time and is not used for claiming orders, recording outcomes, or resuming after a crash. A process restart loses the result set; rerunning input can re-submit payments, while serial processing makes throughput and outage recovery unsuitable for scale-up.

Introduce the smallest durable claim/state machine needed for the deployment model (with leases and safe acknowledgement), then add bounded concurrency with processor rate limits. Make batch sizing, shutdown behavior, and crash recovery explicit and test them.

## 5. Failures are invisible and response handling is too strict (High)

The worker has no logging, metrics, tracing, or structured failure result. It accepts only status `200`, assumes valid JSON, and lets `response.json()` errors enter the same silent infinite retry path. There is no correlation of an order, attempt, processor request, or final disposition, making duplicate-charge investigation and incident response difficult.

Define the processor response contract, validate required fields and amount/order identity, handle expected 2xx responses deliberately, and emit redacted structured telemetry for attempts, latency, status class, and terminal outcomes. Add focused tests for malformed responses, declines, rate limits, and processor errors.

## Verification and remaining uncertainty

Static inspection covered all source, tests, README, deployment notes, and `pyproject.toml`. The available test/build checks could not run because this environment has neither `pytest` nor a `python` executable; no runtime or integration behavior was therefore verified. No application files were changed.
