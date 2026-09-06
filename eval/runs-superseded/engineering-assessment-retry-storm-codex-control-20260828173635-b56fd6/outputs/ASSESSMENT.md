# Payments worker assessment

## 1. Critical — retries can create duplicate charges

`charge()` retries the same POST after every non-200 response or exception, but
the request has no processor idempotency key (`app/worker.py:9-15`). A timeout or
connection failure can happen after the processor has accepted the charge; the
next POST can therefore charge the customer again. The same problem occurs if
multiple replicas receive the same order. The README's idempotency claim is not
implemented (`README.md:3-5`).

Before scaling, send a stable idempotency key derived from the order/payment
attempt, persist the attempt and processor result, and make concurrent delivery
of one order converge on one charge. Reconcile ambiguous outcomes instead of
blindly issuing another charge.

## 2. Critical — a processor outage can pin workers indefinitely

There is no request timeout, retry deadline, maximum attempt count, or
backoff/jitter (`app/worker.py:9-20`). A hung socket can hold a worker forever;
an outage causes a tight fleet-wide retry loop (50 ms sleeps), consuming worker
capacity and generating avoidable processor load. Since `run()` processes orders
serially (`app/worker.py:23-27`), one stuck order blocks every later order in
that invocation.

Set connect/read timeouts, classify retryable responses, use bounded exponential
backoff with jitter, and route exhausted/ambiguous attempts to durable retry or
reconciliation handling. Add a circuit breaker or equivalent fleet-level
protection.

## 3. High — processor authentication is absent and a fallback secret is unsafe

`PROCESSOR_KEY` is loaded but never sent in the request (`app/settings.py:4`,
`app/worker.py:11-15`). If the endpoint requires authentication, all charges
fail; if it accepts unauthenticated traffic, the worker is exposing a payment
operation without the intended credential. The default value
`local-dev-processor-key` also permits an accidental production startup with a
known credential (`app/settings.py:4`).

Require the key in production, inject it through the deployment secret manager,
send it using the processor's required auth mechanism, and fail closed when it
is absent. Never use a known default for a live payment credential.

## 4. High — the declared package cannot satisfy the runtime import

The worker imports `requests` (`app/worker.py:2`), but the project declares no
dependencies (`pyproject.toml:7`). A clean build/install can therefore fail at
startup before processing any payment. This is especially likely in a scaled
deployment where replicas are rebuilt from the project metadata.

Pin and declare the HTTP client dependency, build the deployable artifact from
that lock/metadata, and add a clean-environment import/startup check to CI.

## 5. High — there is no durable work state, ownership, or payment audit trail

`run()` returns an in-memory list and does not read or write the configured
database (`app/worker.py:23-27`; `app/settings.py:3`). A crash after a successful
charge loses the result, while a redelivery or rerun has no durable record to
prevent another charge. There is also no claim/lease mechanism to make the
README's multi-machine safety claim true (`README.md:4`).

Persist an order/payment-attempt state machine with unique constraints, claim
leases and recovery for abandoned work; record processor request IDs and final
outcomes. Treat database and processor reconciliation as part of recovery, not
as an in-memory batch result.

## Verification

Reviewed all application, configuration, test, deployment, README, and project
metadata files in the workspace. The configured test command could not be run
because `pytest` is not installed in the environment; no application files were
changed.
