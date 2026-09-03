# Job Worker Engineering Assessment

## Scope

**In Scope:**
- `src/worker.js` — main worker entry point
- `src/queue.js` — job queue management and persistence
- `src/notify.js` — partner notification logic
- `test/queue.test.js` — test suite
- `package.json` — project configuration

**Out of Scope:**
- Production deployment infrastructure and monitoring
- Partner API behavior and resilience characteristics
- Process manager configuration and restart behavior
- Integration testing with live partner endpoint
- Performance/load testing

**Depth:** Targeted (all in-scope files read in full)

---

## Environment

**Language & Runtime:** Node.js with ES modules (type: "module")

**Key Libraries:** 
- Node.js built-in `fs` and `path` modules
- Native `fetch` (Node.js 18+)

**Domain:** Job queue worker system with file-based persistence

**Architecture:** Single-process worker claiming and completing jobs from a JSON-based queue, notifying external partner on completion

---

## Tooling Results

**Tools Attempted:**

| Tool | Command | Result |
|------|---------|--------|
| Test | `npm test` | Approval required to execute; not run |
| Lint | `eslint .` | No eslint config found; skipped |
| Type Check | `node --check` | No TypeScript; not applicable |

**Note:** No automated checks were executed due to environment constraints. Assessment relies entirely on manual code review.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Reliability | Race condition: concurrent workers can claim same job | `src/queue.js:23-29` — `claimNext()` performs load, modify, save without atomicity; two workers entering simultaneously both see `claimedBy: null` and both claim the same job | Implement atomic compare-and-swap using file locking, or migrate to a proper queue system (Redis, PostgreSQL LISTEN/NOTIFY, or job queue library like Bull/RabbitMQ). At minimum, use fs.writeSync with exclusive lock or transitional file operations (write-then-rename). |
| 2 | Critical | Reliability | Job marked complete before partner notification confirmed | `src/worker.js:7-8` — `complete()` called immediately after `notifyPartner()`, but if notification fails and worker restarts, job is already marked done so it won't retry | Reorder: mark complete only *after* confirmed partner response. If `notifyPartner()` throws, the exception propagates to the process manager, triggering a restart; the job stays unclaimed and is retried on next `runOnce()`. Alternatively, implement idempotent completion (check if already notified before notifying again). |
| 3 | High | Reliability | Unhandled rejection in `notifyPartner()` returns throw on HTTP error | `src/notify.js:10` — if partner returns non-2xx status, `Error` is thrown but `runOnce()` has no `.catch()` or try/catch; the exception propagates to the caller | Wrap `notifyPartner()` call in try/catch and decide whether to: (1) rethrow to trigger process-manager restart (current implicit behavior, but fragile), or (2) log and retry with backoff. Document the intended failure mode. |
| 4 | High | Data Integrity | Incomplete file write can corrupt queue state | `src/queue.js:12` — `fs.writeFileSync()` writes entire state atomically from Node's perspective, but if the process crashes or is killed during write, the file may be truncated or contain partial JSON | Use write-to-temp-then-rename pattern: write to `.data/jobs.json.tmp`, then `fs.renameSync()` to atomic replace. This ensures the file is always complete or unchanged. |
| 5 | High | Reliability | Missing environment variable validation | `src/notify.js:5` — `process.env.PARTNER_WEBHOOK` is used without checking if it exists; if unset, the worker sends requests to `undefined/job-complete` | Add validation at worker startup: check `process.env.PARTNER_WEBHOOK` exists and is a valid URL; throw or log and exit if missing. |
| 6 | Medium | Architecture | Job ID generation can collide if queue state is edited externally | `src/queue.js:17` — IDs are generated as `j${state.jobs.length + 1}`, assuming monotonic growth; if jobs are deleted from the middle or state is manually edited, IDs can collide | Migrate to UUID or monotonic counter stored separately in state (e.g., `{ nextId: 1, jobs: [...] }`). Current risk is low if jobs are only appended, but the assumption is brittle. |
| 7 | Medium | Data Integrity | No validation that JSON serialization succeeds | `src/queue.js:12` — `JSON.stringify(state)` can fail silently if state contains circular references or non-serializable values (e.g., Dates, functions); the file write succeeds but persists corrupted data | Add validation: test `JSON.stringify(state)` before calling `fs.writeFileSync()`, or store job metadata in a schema that explicitly forbids non-serializable types. |
| 8 | Medium | Reliability | No error handling for file system operations | `src/queue.js:6-8, 11-12` — `fs.readFileSync()`, `fs.mkdirSync()`, `fs.writeFileSync()` can throw; `load()` catches read errors but `save()` does not | Add try/catch in `save()` to log or propagate errors distinctly. If save fails, the job state is inconsistent (claimed in memory but not persisted); the worker should crash to alert the process manager. |
| 9 | Low | Maintainability | Test coverage limited to happy path | `test/queue.test.js:5-10` — only one test covering enqueue→claim→complete; no tests for edge cases (concurrent claims, missing jobs, file corruption, notification failures) | Add tests for: (1) concurrent `claimNext()` calls (show race condition); (2) `notifyPartner()` failures and retries; (3) JSON parse failures in `load()`; (4) file system errors. Consider using temp directories for test isolation. |
| 10 | Low | Maintainability | Implicit dependencies between modules | `src/worker.js:1-2` imports `claimNext` and `complete` separately; `notifyPartner` is called without error handling; the contract that completion should follow notification is not documented | Document in a JSDoc or README the intended sequence: claim job → notify partner (may throw) → mark complete. Make the dependency explicit: if notification fails, completion must not happen. |

---

## Unconfirmed Issues

None. All findings above are confirmed by direct code inspection with specific file/line citations.

---

## Summary

### Strengths

- **Clean, readable code structure**: The three modules (`worker.js`, `queue.js`, `notify.js`) have a clear separation of concerns and are easy to follow.
- **Simple API surface**: The public functions (`enqueue`, `claimNext`, `complete`, `notifyPartner`) are minimal and do one thing each, making them composable.
- **Error handling in read operations**: The `load()` function gracefully handles missing or corrupted queue files by returning a default state, avoiding crashes on startup.

### Key Risks

**Critical (must fix before increasing worker count to 4):**

- **Finding #1 (Race condition)**: Running multiple workers with the current queue implementation will result in duplicate job processing. This is almost certain to occur under load and is the primary blocker for scaling.
- **Finding #2 (Job completion before confirmation)**: Jobs can be marked complete even if the partner is never notified, resulting in silent data loss and billing discrepancies.

**High (should fix soon):**

- **Finding #3 & #5 (Error handling & env validation)**: Worker crashes silently on partner API errors or missing config, making debugging difficult.
- **Finding #4 (File write safety)**: A process crash during state writes can permanently corrupt the queue, requiring manual recovery.

### Priority Order

1. **Fix race condition (Finding #1)** — This is the blocker for scaling; implement file locking or atomic operations.
2. **Reorder job completion logic (Finding #2)** — Mark complete only after confirmed partner response; rethrow on failure.
3. **Add environment validation (Finding #5)** — Check PARTNER_WEBHOOK at startup.
4. **Implement safe file writes (Finding #4)** — Use write-to-temp-then-rename pattern.
5. **Add error handling to save() (Finding #8)** — Distinguish file system failures from logic errors.
6. **Improve test coverage (Finding #9)** — Add tests for concurrent claims and failure modes.
7. **Document the job completion contract (Finding #10)** — Make the notification-before-completion invariant explicit.

### Coverage Gaps

- **Test execution not verified** — The test suite was not run due to environment constraints. Manual inspection confirms the single test covers only the happy path.
- **Runtime behavior under failure not observed** — No production logs or error traces were available; findings about failure handling are based on code inspection alone.
- **Concurrent execution not tested** — The race condition in Finding #1 is deduced from code analysis; it was not reproduced in a live environment.
- **File system resilience not tested** — Crash scenarios during file write, disk full, or permission errors were not simulated.
- **Partner API integration not tested** — No test or observation of actual behavior with the partner endpoint; the contract is inferred from comments and code.
- **Scaling validation not performed** — No load testing to measure queue performance or confirm the race condition occurs at scale.

