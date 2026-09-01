# Engineering Assessment

## Scope and depth

**Depth:** deep.

**In scope:** `README.md`, `package.json`, `src/worker.js`, `ops/start-worker.js`, `migrations/007_reset_job_keys.sql`, and `test/smoke.test.js`; runtime behavior, job/ledger ordering, configuration parsing, startup, migration safety, and declared checks.

**Out of scope:** `.agent-input/` workflow material except the required skill and its severity rubric. No evaluation cases, graders, expected answers, sibling outputs, production configuration, deployment manifests, or external services were inspected.

## What I ran

| Command | Result |
|---|---|
| `npm test` | Passed: 1 test, 1 pass, 0 failures. Output included `# worker smoke passed`. |
| `npm run build` | Could not run: `npm error Missing script: "build"`. |
| `npm run lint` | Could not run: `npm error Missing script: "lint"`. |
| `npm run typecheck` | Could not run: `npm error Missing script: "typecheck"`. |
| `npm audit --omit=dev` | Could not run: `ENOLOCK`; no lockfile exists. |

`package.json` declares only the `test` script (`package.json:7`).

## Confirmed findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---:|---|---|---|---|---|
| 1 | High | Startup/reliability | The production launcher starts an entrypoint that is absent from the repository, so the documented production command cannot start the worker. | `README.md:3-4` says production runs through `ops/start-worker.js`; `ops/start-worker.js:3` spawns `src/main.js`; the complete repository inventory contains `src/worker.js` but no `src/main.js`. | Add and test the intended `src/main.js` entrypoint, or change the launcher to the actual entrypoint. Add a startup smoke test that executes the launcher and asserts the child remains running or exits with a useful error. |
| 2 | High | Data integrity/reliability | A job is acknowledged before its effect is recorded. If `ledger.record` fails after the acknowledgement succeeds, the queue has discarded the job while the ledger is missing the result. | `src/worker.js:2-4` executes the job, calls `queue.ack(job.id)`, then calls `ledger.record(job.id, result)`; there is no compensating action or retry around the ledger write. | Make durable recording and acknowledgement part of an explicit recovery protocol: persist the result/idempotency state successfully before acknowledging, and make replay safe with a unique job key and transactional/outbox semantics where applicable. Test ledger failure between the two operations. |
| 3 | High | Data integrity/migrations | Migration 007 unconditionally destroys the idempotency-key table and recreates it empty, deleting all existing deduplication state and offering no rollback. | `migrations/007_reset_job_keys.sql:1-2` runs `DROP TABLE job_idempotency_keys` followed by `CREATE TABLE ...`; the table’s primary key is the only recorded constraint and no preservation/backup/transaction/rollback is present. | Do not reset live state in a normal migration. Use a versioned, transactional schema change that preserves rows, or explicitly archive and restore them with a validated migration and rollback procedure. Add a migration test against a populated table. |
| 4 | Medium | Correctness/configuration | `RETRIES_ENABLED=false` enables retries because JavaScript converts every non-empty environment string to `true`. | `src/worker.js:8-10` returns `Boolean(env.RETRIES_ENABLED)`; `Boolean("false") === true`, so the conventional disabled setting is misinterpreted. | Parse the setting explicitly (for example, accept only `"true"` as enabled and reject/handle invalid values), document accepted values, and test unset, `"true"`, `"false"`, and invalid strings. |

## Unconfirmed / Requires Investigation

- `ops/start-worker.js:4-7` sends `SIGKILL` on `SIGTERM`, which prevents graceful cleanup. The available code does not show whether the child owns active jobs, open connections, or persistence work, so data-loss impact is not confirmed. Inspect the real runtime entrypoint and queue/ledger shutdown contracts, then test termination during each processing phase.
- The worker has no visible retry/error handling around `job.execute`, `queue.ack`, or `ledger.record` (`src/worker.js:2-4`). Whether this causes stuck jobs or process termination depends on the queue client and process supervisor, which are not present in this repository.
- Dependency vulnerability status could not be assessed because there is no lockfile and no dependencies are declared in `package.json`; transitive/runtime dependencies may exist outside the repository.

## Strengths

- The core processing function is small and its effect/result flow is easy to locate (`src/worker.js:1-6`), which makes the ordering defect straightforward to test and remediate.
- The repository has a runnable Node smoke test and it passes (`test/smoke.test.js:1-5`; `npm test`: 1 pass, 0 failures).

## Key risks

Findings 1–3 can prevent production startup or lose job/ledger integrity. Finding 4 can silently enable a behavior operators believe they disabled, increasing duplicate-work exposure when retry behavior is wired in.

## Priority order

1. Restore and exercise the production startup entrypoint (Finding 1).
2. Redesign record/ack ordering and recovery, then test failure injection (Finding 2).
3. Replace the destructive idempotency reset with a data-preserving migration and validate it on populated data (Finding 3).
4. Parse the retry flag strictly and add configuration tests (Finding 4).

## Coverage gaps

- No production entrypoint, queue implementation, ledger implementation, database configuration, deployment configuration, CI configuration, or operational runbook is included, so their contracts and runtime behavior were not examined.
- No load, integration, migration-runner, failure-injection, shutdown, penetration, or production-like end-to-end testing was available.
- Build, lint, and type-check commands were unavailable because they are not declared; dependency audit was unavailable because no lockfile exists.
- Runtime versions, database engine, queue semantics, supervisor behavior, backup policy, and observed production metrics were unavailable.

