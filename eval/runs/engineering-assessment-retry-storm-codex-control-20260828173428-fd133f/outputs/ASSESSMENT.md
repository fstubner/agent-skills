# Payments worker assessment

## 1. Retries can create duplicate charges (critical)

`charge()` retries the same request without sending an idempotency key or
otherwise reconciling an uncertain result (`app/worker.py:7-22`). If the
processor accepts a charge but the response is lost, the next attempt can
charge the card again. This is especially dangerous with multiple replicas.

Require a stable idempotency key derived from the order/payment attempt, and
reconcile ambiguous outcomes with the processor before retrying. Persist the
payment state so a worker restart cannot lose that key or status.

## 2. A processor problem can pin workers forever and amplify the outage (high)

The loop has no maximum attempts, deadline, cancellation path, or request
timeout; it also retries every non-200 response, including permanent 4xx
errors, at a fixed 50 ms interval (`app/worker.py:9-22`). A hung connection can
consume a worker indefinitely, while rapid retries can overload the processor
and delay every later order. Exceptions are silently discarded.

Set connect/read and overall attempt deadlines, classify retryable responses,
use bounded exponential backoff with jitter, and route exhausted/ambiguous
payments to durable retry or manual-review handling. Emit structured metrics
and logs for attempts, outcomes, and abandonment.

## 3. Processing is neither durable nor coordinated across replicas (critical)

`run()` processes an in-memory iterable serially and returns an in-memory list;
it does not claim orders, persist outcomes, or acknowledge work
(`app/worker.py:25-28`). `DATABASE_URL` is loaded but never used, and
`BATCH_SIZE` is defined but not enforced (`app/settings.py:3-5`). Scaling to
three replicas therefore provides no safe work distribution, and crashes can
lose progress or cause reprocessing.

Use a durable queue/table with atomic lease/claim semantics, persisted payment
state, visibility-timeout handling, and explicit completion/failed states.
Implement bounded concurrency and batch limits based on processor and database
capacity, while retaining idempotent execution.

## 4. Processor authentication is misconfigured and the secret is ignored (high)

`PROCESSOR_KEY` has an insecure development fallback (`app/settings.py:4`),
but `charge()` never reads or sends it (`app/worker.py:1-18`). Production
requests will either be unauthenticated or use some accidental alternative,
and a missing secret will not fail fast.

Require the credential in production, reject the development default, pass it
through the processor’s documented authentication mechanism, and ensure it is
never logged or included in order data.

## 5. The declared package cannot run the code it ships (high)

`app/worker.py` imports `requests`, but `pyproject.toml` declares
`dependencies = []`. A clean build/install can therefore fail at import time
with `ModuleNotFoundError`, making a scale-out deployment unusable or
environment-dependent.

Declare and pin an approved `requests` version (and generate/update the lock
metadata used by deployment), then test from a clean installation in CI.

