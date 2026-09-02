# Engineering Assessment: Job Worker

## Scope

**In scope**: 
- `src/worker.js` - main worker entrypoint and orchestration logic
- `src/queue.js` - job queue implementation and state management
- `src/notify.js` - billing partner notification logic
- `test/queue.test.js` - test suite

**Out of scope**:
- Process manager behavior and restart logic
- Partner webhook implementation and behavior
- Production deployment configuration
- Infrastructure and monitoring

**Depth**: targeted — all in-scope files read in full

---

## Environment

**Language/Runtime**: Node.js (ES modules)

**Domain**: Job processing system — workers claim jobs from a persistent queue, notify a billing partner of completion, and mark jobs as done.

**Key architectural constraint** (from README): "Retries are handled by the process manager: if `runOnce` throws, the worker restarts and picks up work again."

---

## What I Ran

**Test command attempted**: `node --test test/queue.test.js`
- **Result**: Command could not be executed due to permission restrictions in this environment.
- **Impact**: Test output is unavailable; findings rely on code analysis and logical inspection.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Reliability | Job stuck in "claimed" state on notification failure | `src/worker.js:4-10` — if `notifyPartner()` (line 7) throws, the job is already claimed by this worker (line 5) but never marked complete. Process restarts and claims a *new* job, leaving the first job permanently claimed. No mechanism exists to unclaim it. | Reorder operations: claim → complete → notify. If notification fails, unclaim the job before re-throwing, or accept the risk and document the recovery process. |
| 2 | Critical | Reliability | Race condition: multiple workers can claim the same job | `src/queue.js:23-30` — `claimNext()` reads disk state, modifies in memory, writes back. No file locking. Two workers calling `claimNext()` simultaneously will both read the same unclaimed job, both modify it, and the last write wins. Result: same job claimed by multiple workers, both attempt notification. | Implement atomic file operations or use a database with transaction isolation, or add a file-locking mechanism (e.g., `fs.promises.open()` with `exclusive` flag for lock files). |
| 3 | High | Reliability | Job completion failure is silent and unchecked | `src/worker.js:8` calls `complete()` but ignores return value. `src/queue.js:32-39` — `complete()` returns `false` if the job is not found (state corruption, or race condition), but the worker treats this as success. Next time the worker runs, it will claim a new job while the old one remains marked done but may not have been notified. | Check the return value of `complete()` at line 8 of `src/worker.js` and throw or log an error if it returns false. |
| 4 | High | Reliability | Fetch call has no timeout | `src/notify.js:5` — `fetch()` call to partner webhook has no timeout set. If the partner endpoint hangs, the worker hangs indefinitely, blocking all processing on that worker until the OS/process manager terminates it. | Add an AbortController with a reasonable timeout (e.g., 30 seconds): `const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30000); await fetch(..., {signal: controller.signal});` |
| 5 | High | Architecture | Data corruption risk from concurrent writes | `src/queue.js:10-13` — `fs.writeFileSync()` without locking. With 4 workers running simultaneously, concurrent `load()/save()` cycles on the same file risk partial writes, truncation, or lost updates. While JSON parse failures are caught in `load()`, a truncated/corrupted write can leave the file in an unrecoverable state for the next read. | Migrate to a database (SQLite, PostgreSQL) with ACID guarantees, or implement a file-locking mechanism (e.g., flocking). File-based state is fundamentally unsafe for concurrent multi-process workloads. |
| 6 | High | Correctness | Job completion can fail silently due to race condition | `src/queue.js:32-39` — `complete()` finds the job by ID. If a job is claimed by worker A but before completion a race condition or external process removes it, `complete()` returns false silently. Additionally, if the disk state is corrupted between claiming and completion, the job will not be found. | Check return value of `complete()` (finding #3), validate that the job exists before attempting to complete it, and implement proper error recovery. Consider adding a "completed_at" timestamp and preventing re-processing. |
| 7 | Medium | Reliability | No error handling or logging in worker orchestration | `src/worker.js:4-10` — no try/catch, no logging. If `claimNext()` or `notifyPartner()` fail unexpectedly (e.g., disk I/O error, JSON parse error), the error propagates silently. Process manager restarts the worker, but there is no audit trail of what failed or why. | Add structured logging to all three functions. Log job claims, notifications, and completions with timestamps. Log errors with stack traces before re-throwing or returning null. |
| 8 | Medium | Reliability | Inadequate test coverage: no concurrency or error scenarios | `test/queue.test.js:1-10` — single test covers only the happy path (enqueue → claim → complete). No tests for: concurrent claims, claim conflicts, notification failure, missing jobs, disk I/O errors, or the worker orchestration logic itself (`runOnce()` is not tested). | Add tests: (a) concurrent `claimNext()` calls to detect race conditions; (b) `notifyPartner()` throwing and validating job state; (c) `complete()` failing and validating error handling; (d) end-to-end `runOnce()` with mocked notify. Consider snapshot testing disk state. |
| 9 | Medium | Security | Predictable job IDs | `src/queue.js:17` — job IDs are sequential (`j1`, `j2`, `j3`, ...) based on job count. An attacker or curious user can enumerate all job IDs and potentially infer business metrics (job volume) or attempt to manipulate jobs if the API is exposed. | Use cryptographically random IDs (e.g., `crypto.randomUUID()` or base64-encoded random bytes). If sequential IDs are required for performance or legacy reasons, document the risk. |
| 10 | Low | Maintainability | Magic string "PARTNER_WEBHOOK" environment variable is undocumented | `src/notify.js:5` — references `process.env.PARTNER_WEBHOOK` without inline documentation or validation. If the variable is missing or malformed, the code will fail at runtime with a generic error. | Add a startup validation function that checks required env vars exist and are well-formed. Log the configuration (sans secrets) on startup. Add a comment in `src/notify.js` referencing the expected format. |

---

## Unconfirmed Issues

**Issue 1: File handle exhaustion** — The `fs.readFileSync()` and `fs.writeFileSync()` pattern in `queue.js` does not explicitly close file handles. While Node.js should manage this automatically, with 4 workers reading/writing the same file thousands of times per minute, monitor OS-level file descriptor usage to confirm no leaks.

**Issue 2: Partial write recovery** — If `fs.writeFileSync()` is interrupted mid-write (e.g., power loss, sudden SIGKILL), the jobs.json file could be truncated or corrupted. The current `load()` catches parse errors and returns `{ jobs: [] }`, which silently loses all queued jobs. Confirm that this recovery strategy is acceptable for your SLA.

---

## Summary

### Strengths

1. **Clear separation of concerns** — `worker.js`, `queue.js`, and `notify.js` are cleanly separated by responsibility. This makes it easy to identify where changes are needed.

2. **Graceful handling of empty queue** — `claimNext()` returns `null` when no jobs are available, and `runOnce()` handles this correctly by returning early (worker.js:6).

### Key Risks

**Critical risks** (#1, #2) must be addressed before scaling the worker count:

- **Finding #1 (job stuck in claimed state)**: Combining the operation order with proper error handling is essential. Without it, jobs can be orphaned.
- **Finding #2 (race condition on job claiming)**: With 4 workers already in production, race conditions are likely occurring silently. Concurrent claims are almost guaranteed under sustained load.

**High risks** (#3–6): These amplify the critical issues and must be fixed alongside them:

- **Finding #3** (silent completion failure) makes it impossible to detect when a job is not actually marked done.
- **Finding #4** (no fetch timeout) risks worker starvation.
- **Finding #5** (concurrent writes) risks permanent data loss.

### Priority Order

1. **Implement atomic job claiming and file locking** (Finding #2) — This is foundational. Without it, all other fixes are incomplete.
2. **Reorder operations to claim → complete → notify** (Finding #1) — Prevent orphaned jobs.
3. **Add error checking after `complete()` call** (Finding #3) — Detect if completion fails.
4. **Add timeout to fetch call** (Finding #4) — Quick fix; prevents stalled workers.
5. **Migrate from file-based state to a database** (Finding #5) — Long-term architectural fix; addresses concurrency, durability, and observability at once.
6. **Add comprehensive error logging** (Finding #7) — Enables production monitoring and debugging.
7. **Expand test coverage** (Finding #8) — Verify fixes work under concurrent load.
8. **Use cryptographic job IDs** (Finding #9) — Security hardening.
9. **Document env var requirements** (Finding #10) — Operational clarity.

### Coverage Gaps

- **Test execution**: Tests could not be run in this environment; findings are based on code inspection.
- **Runtime behavior**: No logs, metrics, or production telemetry were available. The assessment assumes the stated architecture (4 workers, process-manager retries) but has not inspected actual failure modes.
- **Integration testing**: No tests exist for `worker.js` end-to-end or for the interaction between worker, queue, and notify under concurrent load.
- **Deployment and monitoring**: No information on how jobs are enqueued, how stalled jobs are detected, or what observability exists in production.
- **Rollback and recovery procedures**: No documented process for recovering from corrupted state or orphaned jobs.
