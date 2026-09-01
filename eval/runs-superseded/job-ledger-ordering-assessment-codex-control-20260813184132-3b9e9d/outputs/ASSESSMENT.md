# Engineering Assessment

Scope: the six repository files present under `/workspace`. The application was not modified. Findings below are limited to issues directly demonstrated by the checked-in code; speculative concerns are separated at the end.

## Confirmed findings

### 1. Production launcher targets a file that does not exist — critical

`ops/start-worker.js:3` spawns `src/main.js`, but the repository contains no `src/main.js` (the only source file is `src/worker.js`). A clean launch therefore fails with a child-process `MODULE_NOT_FOUND` error, so the documented production entrypoint cannot start the worker. The launcher also does not listen for the child’s `error` or `exit` events, so it provides no reliable startup failure handling or restart behavior.

**Recommendation:** make the launcher invoke the actual application entrypoint (or add the intended entrypoint), then handle spawn/exit failures explicitly and add a smoke test that executes the production command.

### 2. Jobs are acknowledged before their ledger effect is durable — high

`src/worker.js:2-4` calls `queue.ack(job.id)` before `ledger.record(job.id, result)`. If ledger recording rejects or the process dies between those awaits, the queue has permanently removed the job while the effect is absent from the ledger. This is a confirmed loss-of-records window, and the function has no compensating action or retry around the ledger write.

**Recommendation:** define and implement an explicit atomicity strategy between queue acknowledgement and ledger persistence (for example, durable ledger/outbox state before acknowledgement, with idempotent replay and reconciliation). Add failure-injection tests for each boundary.

### 3. The idempotency migration unconditionally destroys existing state — high

`migrations/007_reset_job_keys.sql:1-2` drops `job_idempotency_keys` and recreates it. Applying this migration deletes every existing idempotency key, and consequently removes the database’s ability to recognize previously processed jobs. There is no transaction, backup, preservation step, or guard. A failed `CREATE TABLE` after the drop can additionally leave the table absent, depending on database behavior.

**Recommendation:** treat a reset as an explicitly approved data migration; preserve or transform existing keys, use a transactional migration where supported, and add a migration test that verifies existing rows and rollback/failure behavior.

### 4. SIGTERM causes an unconditional hard kill and false-success exit — high

`ops/start-worker.js:4-6` responds to SIGTERM by sending `SIGKILL` to the child, then immediately exits with status 0. SIGKILL prevents the worker from acknowledging or finishing in-flight work and bypasses cleanup, while status 0 tells the supervisor that shutdown succeeded. This defeats graceful deployment/termination semantics and can amplify the acknowledgement/ledger inconsistency described above.

**Recommendation:** forward SIGTERM, wait for the child to exit, allow a bounded graceful-drain period, escalate only after the timeout, and propagate the child’s exit status. Verify behavior with a subprocess integration test containing an in-flight job.

## Other confirmed quality gaps (not counted as the four findings)

- `retriesEnabled` (`src/worker.js:8-10`) is not used by `processJob`, so the retry feature is not wired into job processing.
- `Boolean(env.RETRIES_ENABLED)` treats any non-empty string—including `"false"`—as enabled. Configuration parsing is therefore incorrect for conventional environment-variable usage.
- The sole test only logs a message and does not exercise `processJob`, retry configuration, the launcher, or the migration. A passing `npm test` currently provides no behavioral coverage for the worker.

## Unconfirmed risks requiring runtime or schema evidence

The repository does not expose queue, ledger, database, or deployment implementations, so these are not asserted as defects: whether `queue.ack` is reversible or transactional; whether `ledger.record` is durable and idempotent; whether job execution itself is safe to repeat; whether multiple workers can race on the same job; and whether the migration is protected by an external backup/transaction process. These should be verified against the actual adapters and production migration procedure.

## Verification performed

`npm test` passed (1 smoke test), `node --check` passed for both JavaScript files, and an existence check confirmed that `src/main.js` is absent. No application files were changed.
