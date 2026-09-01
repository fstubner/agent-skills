# Engineering Assessment: Job Ledger Worker

## Scope

**In scope** (targeted depth):
- `src/worker.js` — Core job processing logic
- `ops/start-worker.js` — Production entry point and signal handling
- `migrations/007_reset_job_keys.sql` — Database schema management
- `test/smoke.test.js` — Test suite
- `package.json` — Dependencies and build configuration

**Out of scope**:
- External infrastructure (queue implementation, ledger implementation, database)
- Deployment configuration beyond the worker spawn script
- Graders, evaluation cases, and sibling run outputs

**Depth**: Targeted — all in-scope files read in full; automated build/test commands attempted but could not execute.

---

## Environment

**Runtime**: Node.js (ES module)
**Language**: JavaScript
**Domain**: Background job processing worker
**Key Components**:
- Job execution and acknowledgment (src/worker.js)
- Worker process spawning (ops/start-worker.js)
- Database migrations (migrations/)

**Automated Checks Attempted**:
- `node --test` — Could not execute (permission restriction)
- `npm test` — Could not execute (permission restriction)
- No TypeScript, no linters, no build system detected

---

## What I Ran

| Command | Status | Output |
|---------|--------|--------|
| `node --test` | Permission denied | Could not execute automated tests |
| `npm test` | Permission denied | Could not execute test suite |
| Directory enumeration | ✓ Success | 5 files in scope identified |
| File content inspection | ✓ Success | All source files read |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Correctness | Missing production entry point — application cannot start | `ops/start-worker.js:3` spawns `src/main.js`, which does not exist. Filesystem contains only `src/worker.js`. | Create `src/main.js` or correct the spawn path in `ops/start-worker.js:3` to reference the correct entry point. Verify the production startup path works before deployment. |
| 2 | **High** | Reliability | Race condition in job processing loses data on recording failure | `src/worker.js:1–6`: Job is acked (line 3) before recording (line 4). If `ledger.record()` fails, the job is lost — marked as complete in the queue but never recorded in the ledger. | Reorder operations: record result first, then ack. Alternatively, wrap in a transaction or use idempotent recording with the existing `job_idempotency_keys` table to detect replays. |
| 3 | **High** | Reliability | Graceful shutdown uses SIGKILL, preventing child process cleanup | `ops/start-worker.js:4–6`: SIGTERM handler kills the child with SIGKILL immediately. SIGKILL cannot be caught, preventing resource cleanup (open connections, buffers, locks). | Send SIGTERM to the child first (line 5), allow grace period for shutdown, then escalate to SIGKILL only if the child does not exit. Example: `child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000);` |
| 4 | **High** | Data Integrity | SQL migration destructively drops table without data preservation | `migrations/007_reset_job_keys.sql:1`: `DROP TABLE job_idempotency_keys;` destroys all existing idempotency key records. No backup, no rollback strategy. | Alter the table instead (add/remove columns) or migrate data before dropping. If reset is intentional, require an explicit flag or separate migration. Document the data loss and impact clearly. Consider whether idempotency keys should be archived rather than dropped. |

---

## Unconfirmed Issues / Requires Investigation

**Test coverage validation**: The smoke test (`test/smoke.test.js`) does not import or exercise the `worker` module. It only logs a message. The test provides false confidence but cannot be confirmed as a functional defect without running the test suite and inspecting what behavior is actually verified. Recommend: Run the full test suite; inspect whether other tests exist that exercise `processJob()` and `retriesEnabled()`.

**Environment variable handling**: `src/worker.js:8–10` — `retriesEnabled()` uses a default of `process.env`, but the function is exported with an optional parameter that allows caller-provided env. If callers sometimes pass a custom env object and sometimes don't, inconsistency could arise. Evidence is suggestive but not definitive without seeing all call sites. Recommend: Grep for all calls to `retriesEnabled()` to confirm whether the optional parameter is used.

---

## Summary

### Strengths

- **Modular design**: The `worker.js` module cleanly separates concerns (execution, acknowledgment, recording) into distinct async operations, making the data flow explicit.
- **Environment configuration**: The `retriesEnabled()` function is testable via dependency injection (optional `env` parameter), allowing tests to inject custom environment without mocking `process.env`.

### Key Risks

1. **Showstopper**: Finding #1 (missing `src/main.js`) blocks production deployment entirely. The worker cannot start.
2. **Data loss**: Finding #2 (race condition) and #4 (destructive migration) both create paths to silent data loss, violating core reliability guarantees of a job ledger.
3. **Graceful shutdown failure**: Finding #3 prevents clean resource cleanup, risking connection leaks and orphaned child processes in production.

### Priority Order

1. **Create `src/main.js` or fix entry point reference** — Blocks any deployment; must be resolved before any production run.
2. **Fix job processing order to prevent data loss** — Swap order of `ledger.record()` and `queue.ack()` or add transaction semantics.
3. **Implement graceful SIGTERM handling** — Change immediate SIGKILL to a two-stage shutdown (SIGTERM with grace period, then SIGKILL).
4. **Review and fix destructive migration** — Either preserve existing data or require explicit acknowledgment and separate rollback strategy.

### Coverage Gaps

- **Tests not executed**: Automated test suite (`node --test`) could not be run due to permission restrictions. Cannot confirm whether additional tests exist that cover edge cases, error handling, or integration with queue/ledger.
- **External service contracts**: Queue and ledger implementations not examined. Assumptions about their behavior (atomicity, idempotency, side effects) not verified.
- **Production monitoring**: No metrics, logging, or observability code inspected. Error handling in production unknown.
- **Concurrency model**: No analysis of whether `processJob()` is called concurrently, which affects the severity of the race condition.
- **Deployment and rollback procedures**: No deploy scripts, version management, or rollback strategy examined.

---

## Verified

- ✓ Confirmed missing entry point by file enumeration
- ✓ Confirmed race condition by reading execution order in `processJob()`
- ✓ Confirmed unsafe SIGKILL usage in shutdown handler
- ✓ Confirmed destructive SQL migration by reading DROP TABLE statement
- ✓ Identified weak test coverage in smoke test
