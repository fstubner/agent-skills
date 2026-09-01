# Engineering Assessment

Scope: the repository contents present in this workspace. Findings are ranked
by operational impact and are limited to issues confirmed by source inspection
or a directly reproducible check.

## Confirmed findings

### 1. Jobs are acknowledged before their effects are durably recorded — Critical

`processJob` calls `queue.ack(job.id)` on line 3 and only then calls
`ledger.record(job.id, result)` on line 4 (`src/worker.js`). If recording fails,
the queue has already been told that the job completed. A restart or retry
cannot recover that work, so the job's effect can be permanently missing while
the queue reports success. The same ordering also makes a transient ledger
failure indistinguishable from successful processing to the queue.

Recommended direction: make the ledger write and acknowledgement a deliberately
designed atomic/outbox workflow, or retain/requeue the job until the ledger
write is confirmed. Add tests for ledger failure and process interruption
between the two operations.

### 2. The production launcher starts a file that does not exist — Critical

`ops/start-worker.js` spawns `src/main.js` (line 3), but no `src/main.js` exists
in the repository. Running the launcher therefore produces Node's module-not-
found failure and cannot start the worker. The only declared npm script runs a
smoke test and does not exercise this production entry point.

Recommended direction: point the launcher at the actual worker entry point (or
add the intended entry point), and add a startup/integration test that executes
the same command used in production.

### 3. The retry feature flag treats the string `"false"` as enabled — High

`retriesEnabled` returns `Boolean(env.RETRIES_ENABLED)` (`src/worker.js`, lines
8–10). Environment variables are strings, so both `RETRIES_ENABLED="true"` and
`RETRIES_ENABLED="false"` are truthy. In a deployment that sets the conventional
string value `false`, retries remain enabled, potentially causing duplicate
processing or unexpected load. The function also enables retries for arbitrary
non-empty values.

Recommended direction: parse an explicit allow-list such as `true`/`1`, decide
the default explicitly, and test true, false, unset, and invalid values.

### 4. The idempotency migration unconditionally deletes all existing keys — High

`migrations/007_reset_job_keys.sql` executes `DROP TABLE job_idempotency_keys`
before recreating it. This irreversibly removes every existing idempotency key,
then creates an empty table with only `job_id` as its primary key. Any replay
protection represented by the old table is lost during migration, so previously
processed jobs may be accepted again after deployment. There is no backup,
rename, data copy, or conditional guard in the migration.

Recommended direction: use an additive/schema-preserving migration, explicitly
transform and validate existing rows, and make any intentional reset a separate
operator-approved procedure with backup and rollback planning.

## Unconfirmed risks to investigate separately

- `processJob` has no visible error handling or recovery policy for failures in
  `execute`, `ack`, or `record`; the correct behavior depends on queue and ledger
  contracts that are not present here.
- The launcher force-kills the child with `SIGKILL` on `SIGTERM` (line 5), which
  may prevent graceful shutdown and in-flight job cleanup. The repository does
  not include enough worker lifecycle code to confirm the resulting loss mode.
- The smoke test only logs that the module can be referenced; it does not test
  job execution, acknowledgement ordering, retries, migration behavior, or
  launcher startup.

## Verification performed

- Inspected all application, launcher, migration, package, README, and test
  files present in the workspace.
- Ran `npm test`: the single smoke test passed.
- Confirmed `src/main.js` is absent and that the production launcher references
  it.
- No application files were changed; this report is the only file added.
