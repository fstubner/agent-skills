# Payments worker assessment

The five highest-value issues to resolve before increasing worker count are:

1. **Critical — duplicate charges are possible on ambiguous failures.** `charge()` retries the same payment after every exception or non-200 response, but the request contains no processor idempotency key (`app/worker.py:9-15`). A timeout can occur after the processor has charged the card, so the next attempt may charge it again. Concurrent replicas make this more likely. Use a stable idempotency key per payment attempt/order, persist the payment state, and reconcile ambiguous outcomes before retrying.

2. **High — a single bad request can hang a worker forever.** The retry loop has no overall deadline, attempt limit, or `requests` timeout (`app/worker.py:9-20`). A processor outage or network black hole can pin every worker indefinitely, preventing later orders from being processed. Add connect/read timeouts, bounded retries with exponential backoff and jitter, and a durable retry/dead-letter state with alerting.

3. **High — permanent failures are retried as if they were transient.** Every non-200 response is retried, including validation, authentication, declined-card, and other non-retryable responses; even a 200 with invalid JSON is swallowed and retried (`app/worker.py:16-19`). This can create hot retry loops and processor load while obscuring customer-visible failures. Classify status/error codes, stop on permanent failures, and record the response safely for operations and reconciliation.

4. **High — replica safety is asserted but not implemented.** `run()` simply processes the supplied orders in memory and has no claim/lease, transactional state transition, acknowledgement, or recovery protocol (`app/worker.py:23-27`). With the documented three replicas per region (`ops/deploy.md:3`), the same order can be delivered to multiple processes, and a crash can leave processing state unclear. Add an atomic database-backed claim/lease and an explicit state machine (pending, processing, succeeded, failed), while retaining processor-side idempotency.

5. **Medium/High — throughput does not scale with replicas or the configured batch size.** Orders are charged strictly serially (`app/worker.py:23-26`), and `BATCH_SIZE = 500` is defined but never used (`app/settings.py:5`). A slow processor call therefore blocks all subsequent orders, causing backlog growth as volume rises. Introduce bounded, rate-limited concurrency and actually batch/stream work in controlled chunks; measure queue age, latency, retries, and processor rate-limit responses before raising concurrency.

