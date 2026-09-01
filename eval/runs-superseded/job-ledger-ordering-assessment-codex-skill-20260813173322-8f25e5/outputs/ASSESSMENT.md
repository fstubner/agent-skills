# Engineering Assessment

## Scope

Depth: **deep**.

In scope were every repository file and directory enumerated before review: `package.json`, `README.md`, `src/worker.js`, `ops/start-worker.js`, `migrations/007_reset_job_keys.sql`, and `test/smoke.test.js`. I examined worker correctness, retry configuration, production startup, migration/data integrity, tests, dependency metadata, and available project tooling.

Out of scope: production infrastructure and deployment manifests (none are present in the repository), the real queue/ledger implementations (not present), runtime database configuration and data, external service behavior, and performance/load, penetration, or disaster-recovery testing. I did not inspect evaluation cases, graders, expected answers, or sibling run outputs.

## Environment

- **Runtime/language:** JavaScript on Node.js, using ECMAScript modules (`package.json:3`).
- **Domain/platform:** background job worker; production is launched through `ops/start-worker.js` (`README.md:4`).
- **Tooling:** npm with a single `node --test` script (`package.json:4`); SQL migration files under `migrations/`.
- **Overlays loaded:** `.agent-input/engineering-assessment/SKILL.md` and its directly relevant `references/severity-rubric.md`.

## Tooling Results

- `npm test` — **passed**: 1 test passed, 0 failed. The test only logs that the worker module can be referenced (`test/smoke.test.js:3-5`).
- Direct Node runtime probe — **passed as a probe and reproduced two defects**: `retriesEnabled({ RETRIES_ENABLED: 'false' })` returned `true`; a successful job emitted `execute -> ack -> record`.
- Startup target check — **failed**: `src/main.js` is missing, although the launcher invokes it.
- `npm audit --json` — **could not run**: npm returned `ENOLOCK` because no lockfile exists.
- `npm run` — **passed** and showed only the test script. No build, lint, type-check, format, or project static-analysis commands are configured; those checks were not attempted because no corresponding configuration or script exists.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Data integrity | Migration `007` unconditionally destroys all existing idempotency keys, defeating duplicate-job protection and risking duplicate effects after deployment. | `migrations/007_reset_job_keys.sql:1-2` executes `DROP TABLE job_idempotency_keys` and immediately recreates an empty table. The migration contains no preservation copy, filtering, transaction, or rollback path. | Replace the destructive reset with a non-destructive schema migration or an explicitly reviewed, backed-up data transformation. If removal is truly required, fail closed until a verified backup/restore and duplicate-processing mitigation are in place. |
| 2 | Critical | Data integrity | Jobs are acknowledged before their ledger effect is recorded, creating a confirmed loss window. | `src/worker.js:1-5` calls `queue.ack(job.id)` at line 3 before `ledger.record(job.id, result)` at line 4. If recording fails after the acknowledgement succeeds, the queue will no longer redeliver the job while the ledger lacks its effect. The runtime probe confirmed the order `execute -> ack -> record`. | Make the acknowledgement conditional on a durable ledger write, or use an explicit transactional/outbox/idempotent protocol that guarantees a failed record remains retryable and a repeated record is safe. Add a test where `ledger.record` rejects and assert the job is not treated as completed. |
| 3 | High | Reliability | The production launcher cannot start the worker because it spawns a module that is absent from the repository. | `ops/start-worker.js:3` spawns `src/main.js`; the repository enumeration contains `src/worker.js` but no `src/main.js`. The startup target check confirmed `src/main.js is missing`. | Add the intended `src/main.js` entry point or change the launcher to the actual entry point, then run the same command used in production as a startup smoke test. |
| 4 | High | Correctness | `RETRIES_ENABLED=false` enables retries because any non-empty environment string is truthy in JavaScript. | `src/worker.js:8-10` returns `Boolean(env.RETRIES_ENABLED)`. A direct probe with `{ RETRIES_ENABLED: 'false' }` returned `true`, so a conventional deployment setting explicitly disabling retries is ignored. | Parse an allowlisted representation explicitly (for example, accept only `true`/`1` case-insensitively), define the unset default, and test unset, `true`, `false`, and invalid values. |

## Unconfirmed Issues

- The actual operational impact of the acknowledgement ordering depends on whether `ledger.record` is independently durable and whether the queue can recover acknowledged jobs; those implementations are absent. The ordering and its loss mode are confirmed, but production frequency cannot be established without those components.
- The migration’s exact rollback behavior depends on the database engine and migration runner, neither of which is declared. The unconditional data-destructive SQL is confirmed; whether the runner wraps it transactionally is unknown.
- Dependency vulnerabilities could not be assessed because there is no lockfile and no declared runtime dependencies; `npm audit` returned `ENOLOCK`.

## Summary

### Strengths

- The worker keeps job execution, queue acknowledgement, and ledger recording in a small, readable function (`src/worker.js:1-6`), making the failure ordering easy to identify and test.
- The package is private and uses a minimal, standard Node test runner configuration (`package.json:2-4`), and the configured smoke test currently passes.

### Key Risks

Findings 1 and 2 can cause silent loss of processing history or duplicate side effects. Finding 3 prevents the documented production startup path from running. Finding 4 can silently change retry behavior in deployments that use the conventional string value `false`.

### Priority Order

1. Stop the destructive idempotency-key reset and establish a safe migration/backup procedure (Finding 1).
2. Correct the acknowledgement/ledger durability protocol and add failure-path tests (Finding 2).
3. Repair the production entry point and execute a real startup smoke test (Finding 3).
4. Implement strict retry flag parsing with table-driven configuration tests (Finding 4).

### Coverage Gaps

- No queue, ledger, database connection, migration-runner, CI, deployment, or production configuration files were present to examine.
- No integration, failure-injection, concurrency, load, security, penetration, or recovery testing was performed.
- `npm audit` could not run without a lockfile; no dependency vulnerability result is claimed.
- No build, lint, type-check, format, or static-analysis commands are configured in `package.json`, so they were not attempted.
- Production metrics, database contents, backup policy, Node.js version, and deployment environment were unavailable.
