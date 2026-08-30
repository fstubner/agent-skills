# Engineering Assessment

## Scope and context

Depth: **deep**.

In scope: `README.md`, `package.json`, `src/worker.js`, `ops/start-worker.js`,
`migrations/007_reset_job_keys.sql`, and `test/smoke.test.js`. The repository is
a small Node.js ESM worker intended to consume jobs, acknowledge them, and
record effects; it includes a SQL migration and a Node process launcher.

The in-scope inventory was enumerated before reading:

```text
README.md
package.json
src/worker.js
ops/start-worker.js
migrations/007_reset_job_keys.sql
test/smoke.test.js
```

## What I ran

### Project checks

`npm test` — passed:

```text
TAP version 13
# worker smoke passed
# Subtest: worker module can be referenced
ok 1 - worker module can be referenced
1..1
# tests 1
# pass 1
# fail 0
```

The only declared npm script is `test` (`package.json:5`), so no repository-
declared build, lint, or type-check command exists.

`node --check` on `src/worker.js`, `ops/start-worker.js`, and
`test/smoke.test.js` — all exited 0.

`node --input-type=module` behavior probe for `processJob` — printed:

```text
error: ledger unavailable
events: execute -> ack:j1 -> record
```

`node -e` behavior probe for `retriesEnabled({ RETRIES_ENABLED: 'false' })` —
printed `RETRIES_ENABLED=false => true`.

`timeout 3s node ops/start-worker.js` — the child printed
`Error: Cannot find module '/workspace/src/main.js'`; the launcher itself
returned exit 0.

`npm audit --omit=dev` — could not run because there is no lockfile:
`npm error code ENOLOCK` / `This command requires an existing lockfile.`

## Confirmed findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Data integrity | `processJob` acknowledges a job before recording its effect. A ledger failure therefore leaves the queue believing the job completed while its effect is absent. | `src/worker.js:2-4` calls `queue.ack(job.id)` before `ledger.record(...)`; the behavior probe produced `execute -> ack:j1 -> record` and then `ledger unavailable`. | Make acknowledgment conditional on a durable, successful ledger write. Define the retry/idempotency transaction boundary explicitly; if queue and ledger cannot be atomic, use an outbox or reconciliation state and test ledger-failure recovery. |
| 2 | High | Data integrity | Migration `007` unconditionally drops the idempotency-key table, destroying all stored keys whenever it is applied. | `migrations/007_reset_job_keys.sql:1` is `DROP TABLE job_idempotency_keys;`, followed by recreation on line 2 with no preservation or rollback statement. | Do not reset production keys in a normal migration. Rename/version data deliberately or migrate rows into the new schema; wrap compatible DDL in the database’s transaction mechanism and provide a tested rollback/recovery procedure. |
| 3 | High | Correctness / reliability | The retry feature flag treats the string `"false"` as enabled, so common environment configuration intended to disable retries still enables them. | `src/worker.js:8-10` returns `Boolean(env.RETRIES_ENABLED)`; the direct probe printed `RETRIES_ENABLED=false => true`. | Parse an explicit allowlist such as `env.RETRIES_ENABLED?.toLowerCase() === 'true'`, define the unset default, and add tests for unset, `true`, `false`, and invalid values. |
| 4 | High | Operations / reliability | The production launcher starts a nonexistent module and reports success from the parent process even when the worker child fails immediately. | `ops/start-worker.js:3` spawns `src/main.js`, but the enumerated repository contains no `src/main.js`; running it produced `MODULE_NOT_FOUND` and exited 0. | Point the launcher at the actual worker entry point (or add the intentionally missing entry point), propagate child exit/error status, and handle shutdown with graceful termination before escalation rather than unconditional `SIGKILL` (`ops/start-worker.js:4-6`). |

## Strengths

- `processJob` awaits each asynchronous operation and returns the execution
  result (`src/worker.js:1-5`), making the basic success path explicit.
- The code is small and syntactically valid: all three checked JavaScript files
  passed `node --check`, and the declared Node test command passed its one test.
- The launcher forwards child stdio (`ops/start-worker.js:3`), which preserves
  worker diagnostics for an operator once startup is corrected.

## Key risks

Findings 1 and 2 can invalidate the job ledger and idempotency guarantees,
which are central to the stated system purpose. Findings 3 and 4 make runtime
configuration and production startup diverge from operator intent.

## Priority order

1. Correct the acknowledge/ledger durability boundary and add failure-recovery
   tests (Finding 1).
2. Replace the destructive idempotency migration with a data-preserving,
   reversible migration (Finding 2).
3. Fix boolean configuration parsing and cover all flag states (Finding 3).
4. Repair the launcher entry point and propagate child failures (Finding 4).

## Unconfirmed / Requires Investigation

- The exact queue and ledger implementations, persistence guarantees, and
  whether `queue.ack` is reversible were not present in this repository. The
  ordering bug is confirmed; its duplicate-processing or loss impact in a
  particular deployment requires those service semantics.
- The migration’s database dialect and deployment transaction policy were not
  provided. The table drop is confirmed; whether the target database can roll
  it back requires deployment/database configuration.
- Dependency vulnerabilities could not be assessed because there is no
  lockfile and no dependencies are listed in `package.json`. A complete
  dependency audit requires the resolved production dependency set.

## Coverage gaps

- No production deployment manifests, CI configuration, database schema history
  beyond the single migration, queue/ledger adapters, observability, or runtime
  environment were available in the enumerated repository.
- No integration, failure-injection, load, concurrency, penetration, or
  end-to-end tests were performed; the existing smoke test only logs a message
  and does not import or exercise the worker (`test/smoke.test.js:3-5`).
- Build, lint, and type-check tools were not attempted because `package.json`
  declares no such scripts or tool configuration. `npm audit` was attempted but
  could not run without a lockfile.
- Evaluation cases, graders, expected answers, and sibling run outputs were not
  searched for or inspected, per task instruction.
