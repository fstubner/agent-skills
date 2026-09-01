# Engineering assessment

Scope: repository contents only. I did not inspect evaluation material, graders,
expected answers, or sibling run outputs.

## Confirmed findings

### 1. Production launcher cannot start the worker — critical

`ops/start-worker.js:3` spawns `src/main.js`, but the repository contains no
`src/main.js`. Running `node ops/start-worker.js` produces
`MODULE_NOT_FOUND` immediately. The README identifies this launcher as the
production entry point, so the shipped worker is not runnable as documented.

Impact: deployment fails before any job can be consumed. Add the intended
entrypoint (or point the launcher at an existing one), and add a smoke test that
actually starts the production command and asserts the child lifecycle.

### 2. Jobs are acknowledged before their ledger record is durable — high

`src/worker.js:3-4` calls `queue.ack(job.id)` before
`ledger.record(job.id, result)`. If recording fails or the process exits between
those calls, the queue has removed the job while the ledger lacks its effect;
the job cannot be recovered through normal redelivery. This violates the
worker's stated consume/record/ack contract and can lose auditability or work.

Impact: a transient database failure can create permanent queue-to-ledger
inconsistency. Define the required durability boundary and implement an
outbox/transactional handoff or a retry-safe record-before-ack flow. Add tests
for record failure and process interruption/failure paths.

### 3. Migration 007 is destructive and not safe for rolling deploys — high

`migrations/007_reset_job_keys.sql:1` drops `job_idempotency_keys` and then
recreates it. The operation deletes every existing idempotency key, and the
drop/recreate window is incompatible with concurrent application versions or
requests that still use the table. It also provides no rollback or preservation
step.

Impact: duplicate-job protection can be erased during deployment, allowing
previously processed jobs to be accepted again; concurrent traffic can fail
while the table is absent. Use additive, backwards-compatible changes, preserve
existing rows, and perform any reset as an explicit, controlled data operation
with a tested rollback/operational procedure.

### 4. `RETRIES_ENABLED=false` is interpreted as enabled — medium/high

`src/worker.js:8-10` converts the environment value with `Boolean(...)`.
Because non-empty strings are truthy, both `RETRIES_ENABLED=true` and
`RETRIES_ENABLED=false` return `true` (as does any typo). The function is also
not used by `processJob`, so its setting currently has no observable effect in
this repository.

Impact: an operator cannot reliably disable retries, and configuration can give
false confidence about runtime behavior. Parse an explicit allowlist such as
`true`/`false`, reject invalid values at startup, wire the result into the
retry policy, and test true, false, unset, and invalid inputs.

## Unconfirmed risks / questions requiring product context

- The correct ordering and atomicity between queue acknowledgement and ledger
  persistence depend on the queue and ledger implementations, which are not
  present. The failure window in the current ordering is nevertheless real.
- It is unknown whether another deployment system supplies `src/main.js` or
  runs a different command; that would need to be reconciled with the checked-in
  launcher and README.
- Queue delivery guarantees, retry limits, ledger uniqueness constraints, and
  the intended semantics of “effect” are unspecified, so duplicate execution
  and recovery behavior cannot be fully assessed.
- The launcher force-kills its child on SIGTERM (`ops/start-worker.js:4-6`),
  which may interrupt in-flight work, but the impact depends on the absent
  worker's shutdown protocol and runtime contract.

## Verification performed

- Enumerated the repository files and inspected the application, launcher,
  migration, package metadata, tests, and README.
- Ran `npm test`: 1 smoke test passed, but it does not exercise job processing,
  migrations, configuration parsing, or the production launcher.
- Ran `node ops/start-worker.js`: confirmed it fails with
  `MODULE_NOT_FOUND: /workspace/src/main.js`.
- No application files were changed; this report is the only added file.
- There is no build script in `package.json`, so no repository build command was
  available to run.
