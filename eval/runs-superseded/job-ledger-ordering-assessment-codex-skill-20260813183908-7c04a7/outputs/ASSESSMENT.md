# Engineering Assessment

## Scope

**Depth:** Deep.

**In scope:** Every repository file and directory enumerated before review:
`README.md`, `package.json`, `src/worker.js`, `ops/start-worker.js`,
`migrations/007_reset_job_keys.sql`, and `test/smoke.test.js`. I examined the
worker lifecycle, retry configuration, production launcher, migration safety,
tests, and package tooling.

**Excluded:** `.git/` and `.agent-input/` were not assessed. Evaluation cases,
graders, expected answers, and sibling run outputs were neither searched for
nor inspected, per request. No production infrastructure, deployment
manifests, queue/ledger implementations, database runtime, or operational
configuration exists in the enumerated repository, so those were not available
for review.

## Environment

The repository is an ES-module Node.js project (`package.json` sets `"type":
"module"`) with no declared runtime dependencies. It contains a small worker
module, a Node child-process launcher, a SQL migration, and Node's built-in test
runner. The stated production entrypoint is `ops/start-worker.js`. No overlay
configuration beyond the engineering-assessment workflow was loaded; the
workflow's severity rubric was used.

## Tooling Results

- `npm test` — passed: 1 test, 1 pass. The test only logs that the worker
  module can be referenced; it does not execute job processing or the launcher.
- `node --check src/worker.js` — passed.
- `node --check ops/start-worker.js` — passed.
- `node ops/start-worker.js` — failed at runtime: Node reported
  `MODULE_NOT_FOUND` for `/workspace/src/main.js`; the parent launcher exited
  with status 0.
- Direct retry-flag check — `RETRIES_ENABLED='false'` returned `true`, while an
  unset value returned `false`.
- `npm audit --omit=dev` — could not run because no lockfile exists
  (`ENOLOCK`).
- Build, lint, type-check, migration execution, integration, load, and
  security tests — not available in the repository and not run.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | The migration destroys the idempotency-key table before recreating it, deleting all existing keys. | `migrations/007_reset_job_keys.sql:1-2` executes `DROP TABLE job_idempotency_keys;` followed by `CREATE TABLE ...`. There is no backup, conditional guard, transaction, or data copy. | Replace the destructive reset with an additive/transform migration that preserves existing rows; if a reset is intentional, require an explicit operational backup and documented data-loss approval before deployment. |
| 2 | High | Reliability | A job is acknowledged before its effect is recorded, so a ledger failure loses the job permanently. | `src/worker.js:2-4` awaits `job.execute()`, then `queue.ack(job.id)`, then `ledger.record(...)`. If `ledger.record` rejects after the ack succeeds, no retry signal remains for that job. | Record the effect and acknowledgment under an idempotent, recoverable protocol: persist the ledger entry before acking, and make replay safe with the job ID as the idempotency key. Define recovery for partial failures. |
| 3 | High | Operations | The documented production launcher cannot start the worker because it spawns a nonexistent entrypoint and reports success anyway. | `README.md:3-4` directs production to `ops/start-worker.js`; `ops/start-worker.js:3` spawns `src/main.js`, which is absent. Running `node ops/start-worker.js` produced `MODULE_NOT_FOUND` for `/workspace/src/main.js` and exited 0. | Point the launcher at the actual worker entrypoint or add the intended `src/main.js`, then propagate child startup/error/exit status and add a startup integration test. |
| 4 | Medium | Correctness | The retry feature flag uses truthiness rather than parsing boolean configuration, enabling retries when configured as the conventional string `"false"`. | `src/worker.js:8-9` returns `Boolean(env.RETRIES_ENABLED)`. A direct execution showed `false= true` for `{ RETRIES_ENABLED: 'false' }`. | Parse an explicit allow-list such as `"true"`/`"false"`, reject invalid values, and test unset, true, false, and malformed configurations. |

## Unconfirmed Issues

- The queue and ledger implementations are absent, so I could not confirm
  whether either operation is transactional or whether an external recovery
  process compensates for the acknowledgment ordering in Finding 2.
- The migration may be run against an empty database in some environments;
  the production data-loss impact therefore depends on deployment state, but
  the destructive SQL itself is confirmed.
- Dependency vulnerabilities could not be assessed because there is no
  lockfile and no dependencies are declared in `package.json`; `npm audit`
  returned `ENOLOCK`.
- Signal handling may cause additional shutdown loss because the launcher uses
  `SIGKILL` (`ops/start-worker.js:4-6`), but the worker's cleanup requirements
  and queue semantics are unavailable, so this is not counted as a separate
  confirmed finding.

## Summary

### Strengths

- The implementation is small and easy to trace: the core processing path is
  six lines in `src/worker.js:1-6`, with no hidden dependency graph in the
  repository.
- Both JavaScript modules pass Node syntax validation, and `npm test` is
  currently green (`test/smoke.test.js`), providing a minimal executable
  baseline.

### Key Risks

Findings 1 and 2 threaten durable job history and idempotency. Finding 3
prevents the documented production process from starting at all. Finding 4 can
silently change retry behavior based on deployment environment-variable
formatting.

### Priority Order

1. Remove or gate the destructive migration and establish a backup/data
   preservation procedure.
2. Redesign ledger persistence versus queue acknowledgment for recoverable,
   idempotent failure handling.
3. Repair and integration-test the production launcher, including child exit
   propagation.
4. Parse and test the retry configuration explicitly.

### Coverage Gaps

- No queue, ledger, database connection, deployment, CI, or production
  configuration files were present to inspect.
- No migration runner or database instance was available, so the migration was
  reviewed statically only.
- No meaningful business-logic tests exercise `processJob`; the lone smoke test
  only references/logs a test condition.
- No load, fault-injection, integration, end-to-end, penetration, or graceful
  shutdown testing was performed.
- `npm audit` could not run without a lockfile; no dependency vulnerability or
  license report was therefore verified.
