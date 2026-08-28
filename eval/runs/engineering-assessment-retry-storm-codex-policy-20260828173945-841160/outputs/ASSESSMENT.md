# Payments worker assessment

The five highest-value findings before scaling are:

1. **Critical — retries can create duplicate charges.** `charge()` retries the same payment after every non-200 response and every exception, but sends no processor-supported idempotency key (only `order_id` in the JSON body). A timeout or connection failure can occur after the processor accepted the charge, so the next attempt may debit the customer again. Persist a payment-attempt state and use a stable idempotency key derived from the payment, with reconciliation for ambiguous outcomes. Evidence: `app/worker.py:9-20`.

2. **High — a processor outage can hang workers indefinitely.** `requests.post()` has no connect/read timeout, the loop has no retry deadline or attempt limit, and `except Exception: pass` hides both transport and programming errors. A stuck request or permanent 4xx/schema failure can occupy a worker forever, with no actionable alert or dead-letter path. Add bounded timeouts, classified retry policy/backoff, a terminal failure state, and observable errors. Evidence: `app/worker.py:9-20`.

3. **High — processor authentication is configured but not applied, with an insecure default.** `PROCESSOR_KEY` is loaded in `app/settings.py` but never used by the request, so charges appear unauthenticated. If the setting is later wired in unchanged, the fallback `local-dev-processor-key` risks being deployed as a real credential. Require the secret in production and send it through the processor’s documented authenticated client/request path. Evidence: `app/settings.py:3-4`, `app/worker.py:11-15`.

4. **High — untrusted order data is sent to the processor without validation or authorization.** The worker trusts `id`, `amount_cents`, and `card_token` directly, performs no type/range/currency/state checks, and has no visible check that the caller is allowed to charge the order. Malformed, replayed, or tampered input can cause incorrect charges or crashes. Validate at the boundary and authorize against the durable order/payment state before charging. Evidence: `app/worker.py:7-15`.

5. **High — scaling has no durable claim/commit protocol and processes a batch serially.** `run()` keeps results only in memory and charges one order at a time; the deployment runs three replicas, but there is no leasing, uniqueness constraint, or durable status transition shown to prevent two replicas from claiming the same order or to resume safely after a crash. This also caps throughput at one in-flight charge per worker. Add an atomic durable claim keyed by payment, durable outcome recording, and bounded concurrency with processor rate limits. Evidence: `app/worker.py:23-27`, `ops/deploy.md:3`.

## Verification and uncertainty

Reviewed all source, configuration, deployment, and test files present in the workspace. The existing tests cover only module import and positive batch size; they do not exercise charging, retries, failures, authentication, idempotency, or concurrent workers. `pytest` and `python` were unavailable in the environment, so tests and compilation could not be run. The processor API’s exact authentication, idempotency, and retry semantics are not documented in this workspace; those details should be confirmed before implementation.
