# Engineering Assessment: Job Worker

## Scope

**In scope**: Complete application code and tests
- `src/worker.js` — main worker entry point
- `src/queue.js` — job queue implementation
- `src/notify.js` — partner notification
- `test/queue.test.js` — test suite
- `package.json` — project configuration

**Out of scope**: 
- External partner service behavior and reliability
- Production infrastructure, deployment config, monitoring
- `.data/` directory (created at runtime; not examined per user instructions)

**Depth**: Targeted — all in-scope files read in full

## Environment

**Language & Runtime**: JavaScript (Node.js ES modules)  
**Runtime version**: Node.js (native `fetch`, native `test` module used)  
**Domain**: Job queue worker system  
**Purpose**: Claim jobs from queue, notify billing partner of completion, mark jobs done  
**Deployment**: Four workers running in production, process-manager driven restarts on crash  
**Build system**: None (plain JavaScript)

## Tooling Results

### What I Ran

| Command | Status | Output |
|---------|--------|--------|
| `node --test test/queue.test.js` | Not attempted | Requires execution approval; code-based analysis performed instead |
| Linting (eslint) | Not available | Not installed in project |
| Type checking (tsc) | Not applicable | Plain JavaScript, no TypeScript configuration |
| Build (npm run build) | Not applicable | No build step defined |
| Audit (npm audit) | Not attempted | Would check npm dependencies; not run due to execution approval flow |

**Rationale for limited tooling**: Assessment proceeds from static code analysis on the specific implementation patterns found.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Data Integrity | Race condition in job claiming — multiple workers can claim the same job simultaneously | `src/queue.js:24-29` — `load()`, then `find()`, then modify, then `save()` is not atomic. Two workers loading concurrently see the same unclaimed job, both mark it claimed by themselves, last write wins. | Replace file-based storage with atomic operations or a proper job queue service (Redis, database with SELECT FOR UPDATE, etc.). If file-based storage must be used, add file-level locking (e.g., `fs.flock` on Unix, or rename-based atomic operations) to ensure only one worker claims at a time. |
| 2 | **Critical** | Reliability | Duplicate notifications to partner on worker restart — job notified before marked complete | `src/worker.js:7-8` — `notifyPartner()` is called before `complete()`. If the notification succeeds but the process crashes before `complete()` executes, the worker restarts, finds the job still unclaimed/incomplete, and notifies the partner again. | Move `notifyPartner()` call **after** `complete()` (order by dependencies: mark done locally first, **then** tell partner). Alternatively, use idempotent keys or deduplication on the partner side if notification order cannot be changed. |
| 3 | **High** | Reliability | No timeout on partner notification — worker can hang indefinitely | `src/notify.js:5-9` — `fetch()` called without timeout configuration. If partner endpoint hangs, worker process is blocked indefinitely, consuming a production slot. | Add a timeout to the `fetch()` call: `fetch(..., { signal: AbortSignal.timeout(5000) })` or equivalent. Choose timeout based on SLA (recommend 5-10 seconds for external partner calls). |
| 4 | **High** | Reliability | No retry logic — transient partner failures cause job loss | `src/notify.js:10` — if `res.ok` is false, an error is thrown immediately. Worker restarts via process manager, picks up the **next** job (not the failed one), and the original job is left unclaimed but marked as claimed by a dead worker. | Implement exponential backoff retry logic for transient errors (5xx, connection timeouts). Either retry within the worker (with a retry counter in the job state) or use a separate dead-letter queue for failed notifications. |
| 5 | **High** | Correctness | Complete operation ignored if job not found — silent failure on data corruption | `src/queue.js:32-39` returns `false` if the job is not found, but `src/worker.js:8` ignores the return value. If the job has been deleted or corrupted, `complete()` fails silently and the worker returns success. | Check the return value of `complete()` in `src/worker.js:8`. If `complete()` returns `false`, throw an error or log a critical alert. |
| 6 | **Medium** | Reliability | No fsync after write — data not guaranteed durable | `src/queue.js:12` — `fs.writeFileSync()` writes to kernel buffer but does not explicitly flush to disk. In the event of a power loss or system crash immediately after write, the job state may be lost. | Call `fs.fsyncSync()` after `writeFileSync()` in the `save()` function to guarantee durability, or accept the risk and document it. |
| 7 | **Medium** | Maintainability | Test suite does not cover concurrent worker scenarios — race conditions undetected | `test/queue.test.js:5-10` — test uses only one worker ('w1') and single-threaded execution. Concurrent claims are not tested. | Add concurrent test cases: spawn multiple simulated workers claiming jobs simultaneously, verify only one worker gets each job. Example: use `Promise.all()` to call `claimNext()` twice in parallel and assert both do not return the same job. |

## Unconfirmed Issues / Requires Investigation

**None** — all findings above are confirmed by direct evidence in the code.

## Summary

### Strengths

1. **Simplicity** — The codebase is minimal and easy to understand at a glance. No external dependencies, no complex abstractions. This aids debugging in production.
2. **Correct high-level flow** — The logical sequence (claim, notify, complete) is sound and reflects the intended business process of notifying the partner only after processing.

### Key Risks

- **Race conditions in multi-worker scenarios** (Findings #1, #5): The file-based queue is fundamentally unsafe for concurrent access. With four workers in production, job loss and duplicate notifications are likely to occur under load.
- **Data loss and retry failures** (Findings #2, #3, #4): Notification order and lack of timeout/retry create a scenario where jobs can be silently lost or duplicated across partner notification and worker crashes.
- **Silent failures** (Finding #5): Errors in completing jobs are ignored, masking data corruption or logic bugs.

### Priority Order

1. **Fix race condition in job claiming** (Finding #1) — Replace file-based storage with an atomic mechanism or add file-level locking. This is the root cause of data loss and must be fixed before scaling.
2. **Reorder notify and complete** (Finding #2) — Mark job complete locally first, then notify partner. This is a simple swap and eliminates duplicate notifications on crash.
3. **Add timeout to partner fetch** (Finding #3) — Prevent worker hangs. One-line fix: add `{ signal: AbortSignal.timeout(5000) }` to fetch options.
4. **Check and handle complete() return value** (Finding #5) — Fail hard if marking a job complete fails. One-line change: throw an error if `complete()` returns `false`.
5. **Add retry logic for partner notifications** (Finding #4) — Implement exponential backoff or dead-letter queue for transient failures. Moderate effort but essential for reliability.
6. **Add fsync after writes** (Finding #6) — Optional depending on durability requirements; low priority if durability SLA is relaxed.
7. **Expand test suite with concurrent scenarios** (Finding #7) — Add parallel claim tests to catch race conditions in CI before production.

### Coverage Gaps

- **No execution of tests** — Static analysis only; test output not confirmed due to execution approval flow.
- **No load testing or stress testing** — Race conditions may not manifest in single-worker scenarios; multi-worker concurrency is untested in CI.
- **No audit of npm dependencies** — `package.json` has no explicit dependencies listed; only Node.js built-ins used. Vulnerability audit not run.
- **No deployment or infrastructure review** — Process manager configuration, worker count scaling strategy, and failover behavior not examined.
- **No partner API specification review** — Partner webhook behavior (idempotency, error codes, timeout tolerance) not verified.
- **No production metrics or logs** — No visibility into actual job failure rates, notification delays, or worker crash frequency in live deployment.

---

## Verification Summary

**What was verified:**
- Static analysis of all source code against correctness, reliability, security, and architecture categories
- Test suite structure and coverage (identified gap: no concurrent scenarios)
- Configuration and environment assumptions (PARTNER_WEBHOOK from env, file-based storage pattern)
- Data flow integrity from claim → notify → complete and error handling at each step

**Critical concern**: The file-based queue with concurrent workers is unsafe. Before scaling from 4 to N workers, **Finding #1 (race condition) must be resolved**. The current implementation will experience job loss and duplicate notifications under concurrent load.
