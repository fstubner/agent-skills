# Engineering Assessment

## Scope and context

Depth: **deep**. I enumerated and read all repository files in scope:

`package.json`, `README.md`, `src/worker.js`, `ops/start-worker.js`,
`migrations/007_reset_job_keys.sql`, and `test/smoke.test.js`.

This is a small Node.js ES-module worker intended to consume jobs, record their
effects, and acknowledge completed work. Its production launcher is under
`ops/`; persistence-related SQL is under `migrations/`. No framework or runtime
dependency is declared.

## What I ran

- `npm test` — passed: 1 test passed, 0 failed. The only test logs
  `worker smoke passed` and verifies only that the worker module can be
  referenced.
- `node --check src/worker.js`, `node --check ops/start-worker.js`, and
  `node --check test/smoke.test.js` — all exited 0.
- `timeout 2s node ops/start-worker.js` — attempted to start, then printed
  `Error: Cannot find module '/workspace/src/main.js'`; shell exit was 0.
- Focused Node execution of `processJob` — observed
  `process order: execute -> ack -> record`.
- Focused Node execution of `retriesEnabled({ RETRIES_ENABLED: 'false' })` —
  observed `true`.
- `npm audit --omit=dev` — could not run: npm reported `ENOLOCK` because no
  lockfile exists.

No build, lint, or type-check scripts are declared in `package.json`; no
additional command was available to run for those categories. `eslint`, `tsc`,
and `sqlite3` were not installed/available in the environment.

## Confirmed findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Correctness / Operations | The documented production launcher cannot start the worker. | `ops/start-worker.js:3` spawns `src/main.js`, but `src/main.js` is absent. Running `timeout 2s node ops/start-worker.js` produced `Error: Cannot find module '/workspace/src/main.js'`. | Point the launcher at the actual executable entry point and add a startup/integration test that invokes the launcher and fails on child startup errors. Also propagate the child’s non-zero exit status; the observed launcher exit was 0 despite the startup failure. |
| 2 | Critical | Data integrity | The migration destroys all existing idempotency keys before recreating the table. | `migrations/007_reset_job_keys.sql:1-2` executes `DROP TABLE job_idempotency_keys;` followed by `CREATE TABLE ...`. Any existing keys are irreversibly removed by the migration, so previously processed jobs can no longer be recognized as duplicates. | Preserve existing rows with an additive, transactional schema change. If a reset is genuinely required, make it an explicit, separately approved data operation with backup/restore and duplicate-processing validation. |
| 3 | High | Reliability / Data integrity | `processJob` acknowledges a job before recording its effect. | `src/worker.js:1-5` awaits `queue.ack(job.id)` at line 3 before `ledger.record(job.id, result)` at line 4. The focused execution confirmed `execute -> ack -> record`. A ledger failure after the ack leaves the job acknowledged without a recorded effect. | Record the effect before acknowledging, with an idempotent ledger operation and a defined recovery strategy. If ordering cannot be made atomic across systems, use an outbox/transactional handoff and retry the record operation before final acknowledgement. |
| 4 | Medium | Correctness / Configuration | The retry feature flag uses truthiness rather than parsing a boolean value. | `src/worker.js:8-10` returns `Boolean(env.RETRIES_ENABLED)`. The focused execution showed `retriesEnabled({ RETRIES_ENABLED: 'false' })` returns `true`; environment variables are strings. | Parse an explicit allow-list such as `value === 'true'` (and define behavior for unset/invalid values), then test true, false, unset, and invalid configurations. |

## Unconfirmed / Requires Investigation

- `ops/start-worker.js:4-6` sends `SIGKILL` on `SIGTERM` and exits immediately.
  The forced termination is confirmed, but whether this causes lost or
  duplicated jobs depends on queue acknowledgement, ledger durability, and
  job idempotency behavior that are not implemented or documented here. Test
  shutdown during execution against the real queue and ledger.
- The migration’s exact transactional and rollback behavior depends on the
  database engine and migration runner, neither of which is declared. The
  destructive `DROP TABLE` itself is confirmed; engine-specific rollback
  behavior was not.
- Dependency vulnerability status could not be assessed with `npm audit`
  because the repository has no lockfile. The manifest declares no runtime
  dependencies, but transitive deployment dependencies were not available.

## Strengths

- The worker’s core function is small and easy to trace: execution, queue, and
  ledger interactions are explicit in `src/worker.js:1-6`.
- All three JavaScript files pass Node syntax checking, and the declared smoke
  test passes (`npm test`).

## Key risks

Findings 1 and 2 prevent reliable production operation and can invalidate
deduplication data. Finding 3 creates a direct acknowledgement-versus-ledger
ordering failure. Finding 4 can silently enable retries under an operator
configuration that explicitly disables them.

## Priority order

1. Fix the launcher and make startup failure observable (Finding 1).
2. Replace the destructive idempotency migration with a reviewed,
   data-preserving migration (Finding 2).
3. Establish durable/idempotent ledger recording before acknowledgement
   (Finding 3).
4. Parse and test the retry configuration (Finding 4).

## Coverage gaps

- No `src/main.js`, queue adapter, ledger adapter, database configuration,
  deployment manifest, CI configuration, or operational runbook exists in the
  enumerated repository files, so those behaviors were not reviewable.
- No build, lint, or type-check command is declared. `eslint`, `tsc`, and
  `sqlite3` were unavailable.
- `npm audit --omit=dev` could not run without a lockfile.
- Only one smoke test exists; unit tests for failure ordering, retries,
  migration execution/rollback, launcher supervision, and shutdown were not
  present.
- No load, fault-injection, integration, penetration, or production-data
  testing was performed. Production metrics, database engine/version, queue
  semantics, and deployment configuration were unavailable.

## What was verified

I verified the complete enumerated repository contents, ran the declared test,
checked JavaScript syntax, executed the production launcher, and directly
observed the job-processing order and retry-flag behavior. No application files
other than this report were changed.
