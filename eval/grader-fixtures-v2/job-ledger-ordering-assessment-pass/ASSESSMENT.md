# Engineering assessment

## Scope

Deep review of every repository file, including `src/`, `migrations/`, `ops/`, and `test/`. Nothing was excluded from file reading.

## Environment

Node.js ES modules with a queue worker, SQL migrations, and an operational launcher.

## Tooling Results

`npm test` passed with exit 0. The single smoke test is assertion-free and only logs a message, so this is a false green: it does not exercise job processing or shutdown.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | The queue acknowledges work before the ledger records it, so a ledger failure loses the job. | `src/worker.js:3` acknowledges; `src/worker.js:4` persists afterward. | Persist the result before acknowledging the queue message; acknowledge only after a successful commit. |
| 2 | High | Data integrity | Deployment drops all idempotency history. | `migrations/007_reset_job_keys.sql:1` drops the table. | Preserve the table and use an additive migration, or back up and migrate existing idempotency keys before replacement. |
| 3 | High | Reliability | Normal termination forcibly kills the child with no drain period. | `ops/start-worker.js:5` sends `SIGKILL`. | Forward `SIGTERM`, stop intake, wait for in-flight jobs to drain, then enforce a bounded timeout. |
| 4 | Medium | Correctness | The string `false` enables retries. | `src/worker.js:9` converts any non-empty environment value with `Boolean`. | Parse explicit accepted boolean values and reject invalid configuration. |

## Unconfirmed Issues

Production queue visibility timeouts and ledger transaction semantics require investigation because deployment configuration and production telemetry were unavailable.

## Summary

The module surface is small and the test command is reproducible. Priority is to reverse the persistence/ack ordering, preserve idempotency history, then implement graceful shutdown. Coverage gaps include load testing, failure-injection testing, dependency audit evidence, and production metrics.
