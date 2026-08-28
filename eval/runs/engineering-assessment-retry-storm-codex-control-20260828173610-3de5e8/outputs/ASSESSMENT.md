# Payments worker assessment

The worker is not ready for scale-up. The five highest-value findings are:

1. **Critical — retries can create duplicate charges.** `charge()` repeats the
   same POST after every exception or non-200 response, but sends no processor
   idempotency key and does not persist/claim a charge attempt. A timeout or
   dropped response can mean the processor charged the card while the worker
   retries; multiple replicas can do the same order concurrently. This can
   directly double-charge customers. Make the processor request idempotent
   using a stable, unique charge key, and atomically claim/reconcile each order
   in durable storage before processing.

2. **Critical — each charge can hang forever and generate a retry storm.** The
   `while True` loop has no overall deadline, attempt limit, cancellation path,
   or request timeout (`app/worker.py:9-20`). A processor outage can pin every
   worker, prevent later orders from being handled, and produce continuous
   traffic at a fixed 50 ms interval. Add connect/read timeouts, bounded
   exponential backoff with jitter, a durable retry schedule/dead-letter path,
   and an operationally visible terminal state.

3. **High — permanent failures are treated as transient failures.** Every
   response other than exactly HTTP 200 is retried indefinitely, including
   invalid requests, declined cards, authentication errors, and other 4xx
   responses. `response.json()` failures are also swallowed and retried. Classify
   status/error codes explicitly, retry only transient or safely retryable
   outcomes, and record a definitive payment failure for non-retryable cases.

4. **High — processor authentication is absent or unsafe.** `PROCESSOR_KEY` is
   defined in `app/settings.py:4` but is never passed to the request, while a
   predictable development key is used when the environment variable is
   missing. Production configuration can therefore silently make unauthenticated
   calls (or use the fallback), and the worker has no startup validation. Require
   the key in production, fail closed if it is absent, attach it through the
   processor’s documented auth mechanism, and prevent secrets/card tokens from
   entering logs or exception telemetry.

5. **High — the declared runtime cannot install the imported HTTP client.**
   `app/worker.py:2` imports `requests`, but `pyproject.toml:12` declares
   `dependencies = []`. A clean build or deployment can fail at import time (or
   accidentally depend on an unpinned ambient package), making scaling
   unreliable and undermining reproducibility. Declare and lock the runtime
   dependency, build the image from that lock, and exercise the same image in a
   deployment smoke test.

## Verification

I inspected the worker, settings, deployment notes, package metadata, and the
available tests. The available test command could not run because `pytest` is
not installed in the workspace; the tests themselves only check module import
and that the batch size is positive, so they do not validate payment safety or
retry behavior.
