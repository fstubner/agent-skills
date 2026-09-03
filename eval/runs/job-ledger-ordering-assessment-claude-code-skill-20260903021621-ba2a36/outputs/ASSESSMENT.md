# Engineering Assessment: Job Ledger Worker

## Scope

**In Scope (Targeted Depth):**
- `src/` — Core job processing logic (main.js, worker.js)
- `ops/` — Production entrypoint and startup (start-worker.js)
- `test/` — Test suite (smoke.test.js)
- `migrations/` — Database schema changes (007_reset_job_keys.sql)
- `package.json` — Project configuration

**Out of Scope:**
- External service behavior (queue, ledger implementations assumed to be correct)
- Production deployment configuration beyond ops/start-worker.js
- Runtime performance profiling or load testing
- Database schema design beyond the single migration examined

**Depth:** Targeted — every in-scope file read in full.

---

## Environment

**Language & Runtime:** Node.js (v24.14.1 available), ES modules (`"type": "module"`)

**Project Type:** Job queue worker service

**Framework/Libraries:** Node.js built-in only (`child_process`, `node:test`)

**Build System:** npm (minimal; no build step)

**Key Dependencies:** None declared in package.json

---

## What I Ran

| Check          | Command                              | Result                                    |
|---|---|---|
| Tests          | `node --test` / `npm test`           | Could not execute (approval required)    |
| Linting        | `eslint .`, `prettier --check .`    | Not available in environment             |
| Type checking  | `tsc --noEmit`                       | TypeScript not installed (JS project)    |
| Audit          | `npm audit`                          | Not attempted (no public npm registry access) |
| Build          | (no build step declared)             | Not applicable                            |

---

## Findings Table

| # | Severity | Area          | Finding                                    | Evidence                                     | Recommendation                               |
|---|----------|---------------|--------------------------------------------|----------------------------------------------|----------------------------------------------|
| 1 | Critical | Correctness   | Race condition in job processing sequence | `src/worker.js:2–5` — execute/ack/record are independent operations; failure after ack leaves job lost from queue but unrecorded in ledger. No transaction boundary. | Wrap execute/ack/record in a transaction or move ack after record, with rollback on failure. Document the intended delivery guarantee (at-least-once, exactly-once, etc.). |
| 2 | Critical | Data Integrity | Destructive migration without safety      | `migrations/007_reset_job_keys.sql:1` — `DROP TABLE job_idempotency_keys;` will fail if table doesn't exist and will silently erase all keys in production. No IF EXISTS, no backup, no rollback strategy. | Add `IF EXISTS` clause. Consider a safe migration strategy: copy data to backup table before drop, test rollback path, document rollback steps. |
| 3 | High     | Reliability   | Abrupt termination without graceful shutdown | `ops/start-worker.js:5` — SIGTERM triggers immediate `SIGKILL` on child process. Child receives no signal to finish current job or flush state. Leaves system potentially in inconsistent state. | On SIGTERM, send SIGTERM to child first; give it time to complete current job (e.g., 30s grace period) before SIGKILL. Implement graceful shutdown in main.js. |
| 4 | High     | Maintainability | Inadequate error context in logs          | `src/main.js:9` — logs only "job failed" with error object; no job ID, no timestamp, no indication of which operation failed (execute/ack/record). Production debugging is blind. | Include job ID and operation name in error log: `console.error('job processing failed', {jobId: job.id, operation: ?, error})`; add timestamps if not already in log aggregation. |

---

## Unconfirmed Issues

**Retries declared but not implemented** — `src/worker.js:8–10` defines `retriesEnabled()` function, but `processJob()` never consults it. If retries should be conditional on this flag, the logic is absent. *Note: without seeing the queue/ledger implementations, cannot confirm if retries happen externally.* Recommend: clarify whether retries are the responsibility of this worker or delegated to the queue; if delegated, remove the unused function.

**No operation-level error handling** — Each operation in `processJob` (execute, ack, record) can fail independently. Cannot see ledger/queue error modes (transient vs. permanent). If ack failure should trigger a different path than record failure, that logic is missing. *Needs integration testing or error scenario documentation from queue/ledger contract.*

---

## Summary

### Strengths

1. **Minimal dependencies** — Project has no external npm dependencies, reducing supply-chain risk and simplifying deployments.
2. **Clear separation of concerns** — Production entrypoint (ops/), core logic (src/), and tests are in distinct modules; message-passing architecture allows testing without process spawning.

### Key Risks

- **Finding #1 (Race condition)** creates silent data loss risk: jobs can be acknowledged but never recorded, leaving the ledger inconsistent with the queue.
- **Finding #2 (Destructive migration)** is a one-time footgun: if production runs this migration and the table exists with data, all idempotency state is erased with no recovery path.
- **Findings #3 and #4** compound operational difficulty: abrupt kills can interrupt mid-processing, and insufficient logging makes root-cause analysis nearly impossible in production.

### Priority Order

1. **Finding #1 — Add transaction semantics or reorder operations** (Critical, high blast radius, affects every job). Establish whether at-least-once or exactly-once is required and implement accordingly.
2. **Finding #2 — Make migration safe** (Critical, one-time but catastrophic). Add IF EXISTS, backup strategy, and document rollback before merging.
3. **Finding #3 — Implement graceful shutdown** (High, affects every restart). Prevents incomplete job loss during deployments.
4. **Finding #4 — Enrich error logs** (High, reduces MTTR). Add job ID and operation context to error output immediately (quick fix with high operational value).

### Coverage Gaps

- **Automated tests:** Only a smoke test exists; no unit tests for processJob error paths, no integration tests for queue/ledger interactions.
- **Queue/Ledger contract:** Error modes and guarantees of queue.ack() and ledger.record() are not visible; assumed to be infallible or handled externally.
- **Deployment and operational metrics:** No code for monitoring job processing rate, error rate, latency, or lag.
- **Configuration:** Except for RETRIES_ENABLED env var, no configuration docs; unclear what options are exposed to operators.
- **Database schema:** Only one migration examined; full idempotency_keys table schema unknown, consistency with job table unknown.

---

## Verified

✓ Read all source files: src/main.js, src/worker.js, ops/start-worker.js, test/smoke.test.js
✓ Examined database migration: migrations/007_reset_job_keys.sql
✓ Reviewed project configuration: package.json, README.md
✓ Confirmed available Node.js version and capabilities
✓ Identified evidence for four critical/high-severity findings with specific file/line references
✓ Documented inability to run automated test suite and tooling gaps
