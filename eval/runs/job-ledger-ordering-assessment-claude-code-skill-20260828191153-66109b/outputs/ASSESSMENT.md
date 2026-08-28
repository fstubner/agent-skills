# Engineering Assessment: Job Ledger Worker

## Scope

**In Scope**
- `src/worker.js` — core job processing logic
- `ops/start-worker.js` — worker startup and process management
- `migrations/007_reset_job_keys.sql` — database schema changes
- `test/smoke.test.js` — existing test coverage
- `package.json` — project configuration and scripts

**Out of Scope**
- `.agent-input/` — evaluation framework (excluded per task instructions)
- Sibling run outputs or evaluation cases
- Integration with external job queues, ledgers, or databases (testing would require live instances)
- Production deployment configuration or monitoring
- Performance testing or load testing

**Depth Level: Targeted**
- Every file in scope has been read in full
- Automated checks attempted where applicable
- No external integrations tested

---

## Environment

**Language and Runtime**
- JavaScript (Node.js), ES modules (`"type": "module"`)
- No external dependencies declared (node built-ins only: `child_process`, `node:test`)

**Framework and Domain**
- Standalone worker process for asynchronous job processing
- Core responsibility: execute jobs, acknowledge them, and record results in a ledger
- Database schema: PostgreSQL (inferred from migration file)

**Build and Test Tooling**
- Test runner: Node.js built-in `node --test` (ESM-native)
- No build step, linter, or type checker configured
- No package-lock.json present; no external dependencies to audit

---

## What I Ran

**Commands Executed**

1. **File Enumeration**  
   Listed all files in repository (excluding `.agent-input/`):
   ```
   ./README.md
   ./migrations/007_reset_job_keys.sql
   ./ops/start-worker.js
   ./package.json
   ./src/worker.js
   ./test/smoke.test.js
   ```

2. **npm test** — `Requested approval; not executed` — requires user permission.  
   *Implication: Actual test pass/fail status could not be verified. Observed test file is minimal.*

3. **Type checking** — Not configured; no linter, no tsc, no pyright equivalent.

4. **Dependency audit** — No external npm dependencies; cannot run `npm audit`.

**Tools Not Attempted** (and why)
- ESLint / Prettier — not installed, no configuration file
- TypeScript — not used; project is plain JavaScript
- Cargo/Rust — not applicable
- Database connectivity tests — would require live database

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | **Startup failure: missing module** | `ops/start-worker.js:3` spawns `src/main.js`, but only `src/worker.js` exists. Application cannot start. | Change line 3 from `spawn(process.execPath, ['src/main.js']` to `spawn(process.execPath, ['src/worker.js']` |
| 2 | Critical | Data Integrity | **Destructive migration deletes idempotency keys** | `migrations/007_reset_job_keys.sql:1` unconditionally executes `DROP TABLE job_idempotency_keys`. In production with retries enabled, all idempotency keys are lost, causing duplicate job processing on next retry. Financial or state-altering jobs will execute twice or more. | Add `IF EXISTS` check; add backup/verification step; add rollback guard; consider renaming table instead of drop to preserve historical data for audit. |
| 3 | High | Reliability | **Unhandled errors cause duplicate job processing** | `src/worker.js:1-6` — `processJob()` does not catch exceptions. If `job.execute()`, `queue.ack()`, or `ledger.record()` throws, job may be partially processed: executed but not acknowledged (retry loop), or executed and not recorded (ledger gap). | Wrap logic in try-catch. On error: decide whether to ack the job (poison pill pattern) or reject; log and report the error before ack; ensure exactly-once semantics or document the duplicate-safe contract. |
| 4 | High | Test Coverage | **Test suite does not validate core functionality** | `test/smoke.test.js:1-5` — test file imports `node:test`, defines one test that only logs a string; it does not import or test the `worker` module. Smoke test passes regardless of whether processJob works. | Add import of `worker` module; mock `job`, `queue`, `ledger` objects; test successful path (job executes, ack is called, record is called); test error paths (execute fails, ack fails, record fails). |

---

## Unconfirmed Issues / Requires Investigation

1. **Idempotency key schema design** — The migration creates `job_idempotency_keys(job_id text PRIMARY KEY)` with no NOT NULL or DEFAULT constraints visible. If job_id can be NULL, the primary key will silently drop or fail. Constraint: would require schema review or database introspection to confirm.

2. **Retry loop semantics** — The `retriesEnabled(env)` function checks `process.env.RETRIES_ENABLED` but the value is never used in `processJob()`. Unclear if retries are actually implemented or if this is dead code. Would require inspecting the `job`, `queue`, and `ledger` objects (injected as arguments) to confirm.

3. **SIGKILL signal handling correctness** — `ops/start-worker.js:5` sends `SIGKILL` to the child process on SIGTERM. SIGKILL cannot be caught; it is unclean. If the job in progress is midway through `ledger.record()`, the process will terminate mid-write, leaving ledger in an inconsistent state. Graceful shutdown would use SIGTERM first, wait for child to exit, then SIGKILL as last resort. Would require testing with a real job in progress to verify impact.

---

## Summary

### Strengths

1. **Minimal dependencies** — Project uses only Node.js built-ins, reducing supply-chain risk and deployment complexity.

2. **Clear functional separation** — Three distinct responsibilities: job processing, queue management, and ledger recording are passed as dependencies, allowing testability in principle.

### Key Risks

- **Finding #1 (Critical)**: Application cannot start in its current state. The entry point references a non-existent file. This is a blocking issue.

- **Finding #2 (Critical)**: The migration destroys the idempotency mechanism. If applied in production, it will cause duplicate job processing for any jobs that enter the retry loop. For financial or state-altering workloads, this is a data integrity breach.

- **Finding #3 (High)**: No error handling in the core job processing loop. Transient failures (network timeouts, database connection drops) in queue.ack() or ledger.record() will cause duplicate or incomplete processing.

- **Finding #4 (High)**: The test suite provides no evidence that the core functionality works. The smoke test is a placeholder that passes unconditionally.

### Priority Order

1. **Fix Finding #1 immediately** (5 min fix).  
   Change `src/main.js` to `src/worker.js` in `ops/start-worker.js`. Unblocks startup.

2. **Review and fix Finding #2 before any database migration run** (review + design, ~1–2 hours).  
   Assess whether this migration has been applied in production. If not, replace it with a safe alternative or delete it. If it has been applied, design a recovery plan.

3. **Add error handling to Finding #3** (30–60 min implementation + testing).  
   Implement try-catch in `processJob()` with explicit error handling and logging. Document exactly-once vs. at-least-once guarantees.

4. **Write integration tests for Finding #4** (1–2 hours).  
   Replace the placeholder test with mocked tests of processJob's success and error paths.

### Coverage Gaps

- **No type checking** — JavaScript is not type-checked. Typos in job.execute, queue.ack, or ledger.record are caught only at runtime.

- **No linting** — Code style and common mistakes (unused variables, inconsistent naming) are not validated.

- **Tests not executed** — The npm test command requires approval. Actual test pass/fail cannot be confirmed.

- **External dependencies not inspected** — The `job`, `queue`, and `ledger` objects are injected at runtime. Their implementation and error contracts are not visible; assessment assumes they can throw exceptions.

- **Production metrics unavailable** — No insight into whether this code has actually failed in production or how frequently jobs are retried/duplicated.

- **Database state unknown** — Cannot verify whether migration 007 has been applied, or whether idempotency keys are actually present in production.

- **Load testing** — No assessment of throughput, latency, or scalability under realistic job volumes.

---

## Verification Summary

**Confirmed:** Four critical and high-severity findings identified through direct code inspection:
1. Missing module reference in startup file (blocking startup)
2. Destructive migration without safeguards (data integrity risk)
3. Unhandled exceptions in job processing (duplicate processing risk)
4. Inadequate test coverage (no functional verification)

All findings are supported by specific file paths and line numbers. No changes were made to the application.
