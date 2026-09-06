# Payments worker assessment

The following are the five highest-value issues to resolve before increasing
replica count or batch size.

1. **Critical — retries can create duplicate charges.** `charge()` resubmits
   the same payment after every exception or non-200 response, but the request
   contains no idempotency key (`app/worker.py:9-15`). A timeout or connection
   failure can occur after the processor has charged the card, so the worker
   cannot distinguish “not accepted” from “accepted but response lost.” With
   multiple replicas, this risk is amplified. Use a durable payment-attempt
   identifier/idempotency key per order and reconcile unknown outcomes before
   retrying.

2. **High — processor calls have no timeout.** `requests.post()` is called
   without a connect or read timeout (`app/worker.py:11`). One stalled network
   connection can hold a worker forever; because `run()` processes orders
   serially (`app/worker.py:23-27`), it also blocks the rest of that batch and
   can exhaust all scaled workers. Set bounded timeouts and make the resulting
   unknown payment state go through reconciliation.

3. **High — every failure is retried forever, including permanent failures.**
   Only status 200 is accepted (`app/worker.py:16`); declines, validation
   errors, authentication failures, and persistent 4xx/5xx responses all loop
   indefinitely with a fixed 50 ms delay (`app/worker.py:20`). This can turn a
   bad order or outage into a request storm and prevents dead-lettering or
   operational recovery. Classify responses, cap attempts/time, and use
   exponential backoff with jitter and a durable retry/dead-letter path.

4. **High — requests are not authenticated with the configured processor key.**
   `PROCESSOR_KEY` is read in `app/settings.py:4` but never used by the request
   (`app/worker.py:11-15`), so the processor call sends no application
   authentication. The fallback value `local-dev-processor-key` also makes a
   missing production secret silently unsafe. Send the key through the
   processor’s required authentication mechanism and fail startup if it is
   absent in production.

5. **High — exceptions and response failures are silently discarded.** A broad
   `except Exception: pass` (`app/worker.py:18-19`) hides malformed orders,
   serialization errors, programming defects, and processor/client failures.
   Combined with the infinite loop, this removes useful observability and can
   leave a poison order consuming a worker permanently. Catch expected
   transport errors explicitly, log structured context without card data, and
   surface unexpected errors to bounded retry/dead-letter handling.

