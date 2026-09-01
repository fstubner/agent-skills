# Engineering Assessment

## Scope

Depth: **deep**.

In scope were every repository file and directory identified before review:
`README.md`, `package.json`, `migrations/007_reset_job_keys.sql`,
`ops/start-worker.js`, `src/worker.js`, and `test/smoke.test.js`, plus the
`migrations/`, `ops/`, `src/`, and `test/` directories. The review covered
runtime correctness, job/data integrity, shutdown behavior, configuration,
testing, and dependency/tooling signals.

Out of scope: `.agent-input/` workflow internals except the required
assessment instructions and severity rubric; evaluation cases, graders,
expected answers, and sibling run outputs; production infrastructure,
database contents, queue/ledger implementations, deployment configuration,
and external service behavior because they are not present in this workspace.

## Environment

- Node.js ES-module project (`package.json` sets `"type": "module"`); the
  runtime used for checks was Node.js v22.12.0.
- Domain: background job worker that executes jobs, acknowledges queue work,
  and records effects in a ledger.
- Tooling: npm with the built-in `node --test` runner; production entry point
  is documented as `ops/start-worker.js`.
- Database migration: SQL migration resetting the idempotency-key table.
- No framework or third-party runtime dependencies are declared.
- Overlay loaded: `.agent-input/engineering-assessment/SKILL.md` and its
  referenced `references/severity-rubric.md`.

## Tooling Results

- `npm test`: **passed** — 1 test passed, 0 failed. The test only logs that
  the worker module can be referenced; it does not execute job processing.
- `node --check src/worker.js`: **passed**.
- `node --check ops/start-worker.js`: **passed**.
- Executing `node ops/start-worker.js`: **failed operationally** with
  `Error: Cannot find module '/workspace/src/main.js'`. The launcher process
  nevertheless returned exit code 0.
- `npm audit --omit=dev`: **not available** — npm reported `ENOLOCK` because
  no package lockfile exists.
- Build, type-check, lint, formatter, migration runner, integration tests,
  load tests, and security scans: not configured or not available in the
  repository.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | The migration irreversibly deletes all idempotency keys whenever it is applied. | `migrations/007_reset_job_keys.sql:1-2` executes `DROP TABLE job_idempotency_keys` and recreates an empty table; there is no backup, transaction, conditional guard, or data-preserving migration. | Replace the drop/recreate operation with an explicitly reviewed data-preserving migration, or document and gate the reset as a deliberate destructive operation. Take a verified backup and add a migration test that proves existing keys are retained unless deletion is explicitly required. |
| 2 | High | Correctness / reliability | A job is acknowledged before its effect is recorded, so a ledger failure causes acknowledged work to be lost from the ledger and prevents a reliable retry. | `src/worker.js:2-4` awaits `job.execute()`, then `queue.ack(job.id)`, then `ledger.record(job.id, result)`. If `record` rejects after `ack` succeeds, the queue no longer offers the job while the ledger lacks the result. | Establish an explicit atomicity/idempotency strategy: record the effect durably before acknowledging, or use an outbox/transactional handoff and make both recording and replay idempotent. Add a test where `ledger.record` rejects and assert the job remains recoverable. |
| 3 | High | Operations / reliability | The documented production launcher starts a file that does not exist and masks the child failure with a successful parent exit. | `ops/start-worker.js:3` spawns `src/main.js`, but `src/main.js` is absent. Running `node ops/start-worker.js` emitted `MODULE_NOT_FOUND` and returned `launcher_run_exit=0`; the launcher has no `child.on('error')` or `exit` handling. | Point the launcher at the actual worker entry point or add the missing entry point, then propagate child startup/exit failures and non-zero status to the supervisor. Add a smoke test that launches the production command and requires a valid entry point. |
| 4 | Medium | Configuration correctness | `RETRIES_ENABLED` is interpreted by string truthiness, so the conventional value `"false"` enables retries. | `src/worker.js:8-10` returns `Boolean(env.RETRIES_ENABLED)`; in JavaScript `Boolean("false")` is `true`. | Parse an allowlisted representation such as exactly `"true"`/`"false"`, reject invalid values, and test unset, `"true"`, `"false"`, and invalid inputs. |

## Unconfirmed Issues

- The queue and ledger implementations are absent, so the exact recovery
  semantics, transaction support, and whether `ledger.record` is inherently
  idempotent could not be verified. Finding 2 is confirmed at the worker
  sequencing level; those missing implementations determine the full blast
  radius.
- Whether migration `007` has already run in production, and whether an
  independent database backup exists, is unknown. The destructive behavior
  is confirmed from the SQL itself; production impact is not verified.
- The intended meaning and deployment values of `RETRIES_ENABLED` are not
  documented. The string-parsing bug is confirmed for a `"false"` environment
  value.

## Summary

### Strengths

- The worker’s core flow is small and easy to trace in `src/worker.js:1-6`,
  with explicit async boundaries for execution, acknowledgment, and ledger
  recording.
- The project has a minimal runnable test command and the checked JavaScript
  files pass syntax validation. `npm test` completed with 1 passing test.

### Key Risks

Findings 1–3 can prevent safe production operation or lose durable job state:
the migration can erase the idempotency table, processing can acknowledge work
before recording its effects, and the production launcher cannot start the
worker while reporting success. Finding 4 can silently invert an operational
retry setting.

### Priority Order

1. Correct the production entry point and propagate child failures (Finding 3).
2. Define and implement durable record/acknowledgment atomicity and failure
   recovery (Finding 2).
3. Stop or formally gate the destructive idempotency migration, with backup
   and migration tests (Finding 1).
4. Fix boolean environment parsing and add configuration tests (Finding 4).

### Coverage Gaps

- No queue, ledger, application entry point, deployment manifests, CI files,
  database schema history, or operational configuration were present to review.
- No lockfile exists, so `npm audit` could not resolve a dependency graph.
- No build, lint, type-check, migration runner, integration, end-to-end,
  concurrency, failure-injection, load, penetration, or disaster-recovery
  tests were available or performed.
- Production database state, backups, monitoring, supervisor behavior, and
  actual environment-variable values were unavailable.
- The smoke test does not exercise `processJob`, retry configuration, the
  migration, or the production launcher.

