# Engineering Assessment: job-ledger-worker

## Scope

**In Scope:**
- `src/main.js` — IPC message handler and process lifecycle
- `src/worker.js` — Job processing logic and retry configuration
- `ops/start-worker.js` — Child process spawning and signal handling
- `migrations/007_reset_job_keys.sql` — Database schema migration
- `test/smoke.test.js` — Test suite
- `package.json` — Project configuration and dependencies

**Out of Scope:**
- Parent process implementation (ops/start-worker.js caller)
- Database schema beyond the migration file
- Queue and ledger implementations (passed as handles via IPC)
- Runtime environment (Node.js version specifics, deployment infrastructure)

**Depth:** Targeted — all in-scope files read in full; automated checks attempted but not executable due to approval requirements.

---

## Environment

**Language & Runtime:** Node.js with ES modules (`type: "module"`)

**Framework & Libraries:** None (minimal dependencies); uses Node.js built-ins only

**Domain:** Background job processing worker; consumes jobs from a queue, executes them, acknowledges completion, and records results in a ledger

**Platform:** Node.js process spawned as a child by a parent orchestration process via `spawn()`

**Build System:** None declared; npm scripts include only `test`

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | Approval required; not executed |
| `node --test test/smoke.test.js` | Approval required; not executed |
| `npm audit` | Not attempted (requires npm install; no approval) |
| `eslint` or similar linters | Not found in project |
| Build commands | None declared in package.json |

**Summary:** Test and lint commands could not be run due to execution approval gates. Static analysis of source code proceeds from direct file inspection.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Data Integrity | Destructive non-idempotent migration | `migrations/007_reset_job_keys.sql:1–2` — `DROP TABLE` with no conditional guard. Re-running this migration destroys all job_idempotency_keys data on subsequent replays. | Rewrite as: `IF EXISTS` conditional drop, or create a new migration file. Ensure migrations are idempotent and safe to replay. |
| 2 | **High** | Reliability | Graceful shutdown not implemented; SIGKILL used | `ops/start-worker.js:5` — `child.kill('SIGKILL')` on SIGTERM does not allow the worker process to finish current operations. Jobs executing at termination time are aborted without acknowledgment or rollback. | Replace `SIGKILL` with `SIGTERM`; add signal handler in `src/main.js` to allow job completion before exit. |
| 3 | **High** | Data Integrity | Partial failure during job processing | `src/worker.js:2–4` — Three sequential async operations (execute, ack, record) have no transaction. If ack() fails after execute() succeeds, the job result is applied but not removed from queue, causing re-execution. If record() fails after ack(), the job is dequeued but not logged. | Wrap in a transaction; use the unused `job_idempotency_keys` table to prevent duplicates; or add explicit error recovery. |
| 4 | **High** | Architecture | Idempotency table created but never used | `migrations/007_reset_job_keys.sql` creates `job_idempotency_keys(job_id PRIMARY KEY)` but `src/worker.js` never queries it. Duplicate job executions are not prevented in code. | Implement idempotency check in `processJob()`: query/insert into idempotency_keys before execute(); fail gracefully if already processed. |

---

## Unconfirmed Issues

| Issue | Evidence Gap | Investigation Needed |
|-------|---------------|---------------------|
| Message handler allows undefined parameters | `src/main.js:5` receives `{ job, queue, ledger }` destructuring with no validation. However, this is an internal IPC contract. | Confirm whether the parent process guarantees these fields are always present, and whether it validates before sending. If not, add parameter validation in the message handler. |
| Process exit timing and cleanup | When `processJob()` throws and exits with `exitCode = 1`, it is unclear whether any in-flight async operations (queue.ack, ledger.record) complete before the process halts. | Requires runtime tracing or process exit investigation; code does not explicitly await or drain pending operations. May be acceptable if queue/ledger clients handle disconnection gracefully. |
| Retry configuration via env var only | `retriesEnabled()` checks `env.RETRIES_ENABLED` but never documents when retries are used or applied. | Need to locate where retries are actually triggered (likely in parent process queue implementation). No visible retry loop in worker itself. |

---

## Summary

### Strengths

- **Minimal surface area:** The worker isolates job processing logic in a testable function (`processJob`) independent of message passing or process lifecycle.
- **Clean separation of concerns:** Main.js handles IPC lifecycle; worker.js contains pure processing logic; ops/start-worker.js manages process spawning. Easy to reason about.
- **Database schema versioning:** Migrations directory is present, indicating version control of schema changes.

### Key Risks

1. **Critical migration safety issue (Finding 1):** The destructive DROP without a conditional guard poses a data loss risk if migrations are replayed or run out of order.
2. **Duplicate execution risk (Findings 3–4):** Lack of idempotency enforcement combined with partial failure scenarios can cause jobs to run more than once, especially if jobs have side effects.
3. **Ungraceful termination (Finding 2):** Using SIGKILL prevents the worker from finishing its current job, risking orphaned queue entries and incomplete ledger records.

### Priority Order

1. **Fix migration safety (Finding 1)** — Blocks confidence in any automated deployment. Quick fix; high impact.
2. **Implement graceful shutdown (Finding 2)** — Prevents data loss during normal process restarts. Moderate effort; high reliability gain.
3. **Enable idempotency enforcement (Finding 4)** — Use the already-created `job_idempotency_keys` table. Moderate effort; eliminates duplicate execution risk.
4. **Add transaction or error recovery (Finding 3)** — Architectural fix to ensure consistency across execute/ack/record. Requires coordination with queue and ledger implementations.

### Coverage Gaps

- **Cannot run tests:** Test suite and any lint checks could not be executed due to approval requirements. The smoke test passes structurally (imports worker module), but the actual job processing logic is not tested in this run.
- **Cannot inspect queue/ledger implementations:** The queue and ledger are passed as opaque handles via IPC. Their error modes, recovery behavior, and consistency guarantees are unknown.
- **Production usage patterns unknown:** Risk assessment depends on whether jobs are idempotent, whether the queue has built-in retry mechanisms, and how frequently SIGTERM is used (graceful shutdown frequency).
- **No load or integration testing:** Cannot assess behavior under concurrent jobs, high throughput, or failure cascades.
- **Deployment and monitoring:** No visibility into how workers are deployed, monitored, or how failures are observed in production.

---

## Verification Notes

I read all source files (`src/`, `ops/`, `migrations/`, `test/`), enumerated the complete file tree, and examined package.json and README. The four findings above are confirmed by direct code inspection. The unconfirmed issues reflect gaps in visibility into the parent process contract and runtime behavior of the queue and ledger implementations.
