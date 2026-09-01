# Engineering assessment

## Scope and conclusion

Assessment is based on the repository contents at the time of review. The
implementation is not runnable through its documented production entrypoint,
and the core job path can acknowledge work before its durable effect is
recorded. The smoke test does not exercise either behavior.

## Four highest-value confirmed findings

### 1. Production launcher targets a file that does not exist — Critical

`ops/start-worker.js` spawns `src/main.js`, but the repository contains only
`src/worker.js`; there is no `src/main.js`. Running `node ops/start-worker.js`
produced `MODULE_NOT_FOUND`. The parent launcher still exited with status 0 in
the observed run because it neither listens for the child `error`/`exit` event
nor propagates the child exit status. A supervisor can therefore see a
successful launcher invocation while no worker is running.

The launcher should start the actual application entrypoint (or the missing
entrypoint must be supplied), and should fail non-zero on spawn/startup failure
and on unexpected child exit. Add an integration test that invokes the
production command and asserts startup and failure propagation.

### 2. Jobs are acknowledged before their effects are recorded — Critical

`src/worker.js:2-4` executes the job, calls `queue.ack(job.id)`, and only then
calls `ledger.record(job.id, result)`. If ledger persistence fails or the
process terminates between those calls, the queue has removed the job while
the effect is absent. This is confirmed by the ordering in the implementation;
the repository does not provide a transaction, outbox, or compensating retry
mechanism that would close that gap.

The workflow needs an explicit durable-state strategy: record an idempotent
completion (or intent/outbox) before acknowledgement, with retry-safe
recovery, or use a transaction/queue protocol that atomically covers both
operations. Tests should cover ledger failure and termination/retry semantics.

### 3. `RETRIES_ENABLED=false` enables retries — High

`retriesEnabled` returns `Boolean(env.RETRIES_ENABLED)`. Environment values are
strings, so both `"true"` and `"false"` are truthy. Consequently, setting the
common configuration value `RETRIES_ENABLED=false` returns `true`; only an
unset/empty value returns `false`. No caller currently uses this helper, but
its exported contract is demonstrably incorrect and will invert an explicit
production setting when wired in.

Parse a documented allowlist such as exactly `"true"`/`"false"`, reject or
default invalid values deliberately, and add tests for unset, true, false, and
invalid input before enabling retry behavior.

### 4. Migration destroys existing idempotency state and is not rolling-safe — High

`migrations/007_reset_job_keys.sql` unconditionally executes `DROP TABLE
job_idempotency_keys` and recreates it with only `job_id`. Applying it deletes
all existing keys, removing the database's deduplication history and allowing
previously processed jobs to be treated as new. The unconditional drop also
requires exclusive schema coordination and is incompatible with a rolling
deployment in which old and new workers may overlap. There is no transaction,
backup, compatibility phase, or data-preserving replacement shown in the
repository.

Use additive, backwards-compatible changes: preserve or migrate existing rows,
introduce new schema alongside the old one, deploy code that can read both
versions, and remove the old structure only after the fleet is migrated. Add a
migration test against representative existing data and an operational
rollback/backup procedure.

## Unconfirmed risks kept separate

The following could not be confirmed from this repository and are not counted
as findings: whether `job.execute()` or `ledger.record()` have external side
effects, whether queue acknowledgement and ledger writes share a datastore or
transaction, whether jobs require authentication/authorization at a boundary,
and whether an external deployment system supplies `src/main.js`. These need
runtime, infrastructure, or schema context before making a claim.

## Verification performed

- Reviewed all repository source, launcher, migration, package metadata, README,
  and tests; no application files were changed.
- `npm test` passed: 1 test passed, but it only logs a message and does not
  import or execute the worker.
- `node --check src/worker.js` and `node --check ops/start-worker.js` passed.
- Running `node ops/start-worker.js` produced `MODULE_NOT_FOUND` for
  `/workspace/src/main.js` and returned launcher status 0.
- `npm run build` could not run because `package.json` has no `build` script.
