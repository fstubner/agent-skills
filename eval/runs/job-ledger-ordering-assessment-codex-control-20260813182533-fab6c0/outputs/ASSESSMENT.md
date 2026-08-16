# Engineering assessment

Scope: repository contents available in this workspace. The application code was not modified.

## Confirmed findings

### 1. Production launcher cannot start the worker and masks the failure

**Severity: Critical** — `ops/start-worker.js:3,6`

The launcher spawns `src/main.js`, but that file is absent from the repository. Running `node ops/start-worker.js` produced `MODULE_NOT_FOUND` from the child process. The parent then exits with status 0 because the SIGTERM handler calls `process.exit(0)` and there is no child `error`/`exit` handling that propagates startup failure. Production orchestration can therefore observe a successful launcher exit while no worker is running.

### 2. Jobs are acknowledged before their ledger record is durable

**Severity: Critical** — `src/worker.js:2-4`

`processJob` executes the job, calls `queue.ack(job.id)`, and only then calls `ledger.record(job.id, result)`. If recording fails or the process terminates between those calls, the queue has already removed the job while the ledger lacks its effect. This violates the README's stated consume/record/ack behavior and creates an unrecoverable gap unless the queue and ledger provide an unshown transaction or recovery protocol. No such protocol exists in this repository.

### 3. SIGTERM causes immediate, ungraceful worker termination

**Severity: High** — `ops/start-worker.js:4-6`

On SIGTERM, the launcher sends `SIGKILL` to the child and immediately exits 0. `SIGKILL` cannot be handled by the child, so in-flight jobs cannot finish, release resources, or perform acknowledgment/ledger cleanup. The parent also does not wait for the child or report its termination status. During routine deployments or autoscaling, this can interrupt work without a graceful-drain window.

### 4. Migration 007 irreversibly deletes all idempotency keys

**Severity: High** — `migrations/007_reset_job_keys.sql:1-2`

The migration drops `job_idempotency_keys` and recreates it with only the primary-key column. Applying it deletes every existing idempotency key and any associated metadata, with no backup, rename, transactional guard, or data migration. Reprocessing previously completed jobs can consequently become possible after deployment. The statement also fails if the table is absent, because it does not use a conditional drop.

## Unconfirmed risks requiring additional system context

- `src/worker.js:9` treats any non-empty string as enabled, so values such as `"false"` enable retries. This is a confirmed parsing behavior, but its operational impact is unconfirmed because this repository contains no caller or retry loop.
- The worker has no local retry, timeout, or compensation handling around `execute`, `ack`, or `record`. Whether an external queue/ledger wrapper supplies those guarantees cannot be established from this repository.
- The migration's effect on production data volume, deployment rollback behavior, and whether it runs inside a transaction depends on the unavailable migration runner and database configuration.

## Verification performed

- Enumerated the repository files and reviewed the worker, launcher, migration, README, and test.
- Ran `npm test`: the single smoke test passed, but it only checks that a test module runs.
- Ran `node ops/start-worker.js`: confirmed the missing `src/main.js` error and observed launcher exit status 0.
