# Engineering Assessment: Job Worker

## Scope

**In scope:**
- `src/worker.js` — main worker loop implementation
- `src/queue.js` — job queue and state management
- `src/notify.js` — partner notification mechanism
- `test/queue.test.js` — unit tests
- `package.json` — project configuration

**Out of scope:**
- External services (partner billing webhook, process manager/orchestration)
- Production deployment configuration
- Integration tests with real partner endpoint
- Load testing and performance benchmarking

**Depth:** Targeted — all in-scope files read in full.

---

## Environment

**Platform:** Node.js v24.14.1, ES modules  
**Language:** JavaScript  
**Domain:** Distributed job worker system; claims jobs, notifies a billing partner, marks jobs complete  
**Build system:** npm (no build step; runs directly)  
**Persistence:** JSON file (`jobs.json`) in `.data/` directory  

---

## Tooling Results

### What I ran

| Check | Command | Result |
|-------|---------|--------|
| Test | `node --test test/queue.test.js` | **Could not execute** — requires special approval. Basic test file reviewed manually. |
| Node version | `node --version` | v24.14.1 (passes minimum requirements) |

**Tools available but not run:** `npm audit` (no `npm` lockfile present, not critical given scope); no linter, type checker, or build tool configured.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Reliability | Race condition: concurrent job claims | `src/queue.js:23–29` — `claimNext()` reads state, modifies job, saves. Between read and write, another worker reads same state and claims same job. Multiple workers can claim identical job. | Implement atomic operations (e.g., file-based locking, database transactions, or compare-and-swap pattern) so that claim + state update is indivisible. |
| 2 | **Critical** | Reliability | Incomplete transaction: job claimed but not marked done on error | `src/worker.js:4–10` — if `notifyPartner(job.id)` throws, the job remains claimed but never reaches `complete()`. On restart, the job is re-claimed (potentially by a different worker); state is inconsistent. | Ensure `complete(job.id)` runs even if notify fails. Wrap in try/finally or use a retry loop with exponential backoff. Consider idempotent notification. |
| 3 | **High** | Reliability | Stale claimed jobs never released | `src/queue.js:27` — once `claimedBy` is set, no mechanism exists to release the job if the worker crashes. Job remains claimed indefinitely; production queue grows with orphaned jobs. | Implement job expiration (e.g., claim timestamp + TTL) or a separate "release" function for crashed workers. Monitor and alert on claimed-but-not-completed jobs. |
| 4 | **High** | Architecture | Job ID generation collisions | `src/queue.js:17` — ID is `j${state.jobs.length + 1}`. If jobs array shrinks (e.g., due to deletion, file corruption, or state reset), IDs can collide with existing jobs. No uniqueness guarantee. | Use a deterministic counter (e.g., incremented ID stored separately) or UUID. Validate ID uniqueness on enqueue. |
| 5 | **High** | Maintainability | Test coverage gap: no concurrency testing | `test/queue.test.js:5–10` — tests only enqueue, claim, complete in serial. No concurrent claim attempts, no error simulation, no state corruption recovery. | Add tests: (a) two workers claiming simultaneously; (b) notify failure and retry; (c) claimed job timeout; (d) corrupt/missing jobs.json recovery. |
| 6 | **Medium** | Reliability | Missing PARTNER_WEBHOOK environment variable validation | `src/notify.js:5` — reads `process.env.PARTNER_WEBHOOK` without checking if it exists. If undefined, fetch URL becomes `undefined/job-complete`, causing a cryptic network error. | Validate `PARTNER_WEBHOOK` at startup (e.g., in worker initialization or notify module load). Throw with a clear error message if missing. |
| 7 | **Medium** | Maintainability | No logging or observability | `src/worker.js` and `src/queue.js` — no logs of which worker claimed which job, no timing info, no error context. Troubleshooting production failures is difficult. | Add structured logging: (a) job claimed by worker ID and timestamp; (b) notify success/failure; (c) state read/write duration; (d) errors with full context. |
| 8 | **Low** | Maintainability | Implicit error recovery in load() | `src/queue.js:7` — catch-all on JSON parse silently returns `{ jobs: [] }`. If the file is corrupted, this discards all jobs without warning. | Log the parse error and file path. Consider preserving the corrupted file (e.g., rename to `.backup`) and alerting ops. |

---

## Unconfirmed Issues

None at this time. All issues above are confirmed by direct code inspection.

---

## Summary

### Strengths

1. **Simple, readable design** — the queue and worker are straightforward and easy to understand at a glance. Appropriate for a clear, single-responsibility job loop.
2. **Synchronous persistence model** — JSON file write ensures state is durable before the function returns, reducing some edge cases compared to async writes.

### Key Risks

**Critical (affects correctness and data consistency):**
- **Race condition (Finding #1)**: Multiple workers can claim the same job. This likely doubles or multiplies processing of jobs in production, leading to duplicate charges, duplicate side effects, and potential data corruption.
- **Incomplete transaction (Finding #2)**: A failed notify leaves a job in a broken state. Restart picks it up again; if the issue is transient, it may eventually succeed, but if the partner endpoint is down, jobs pile up, and workers retry forever.

**High (affects reliability and scalability):**
- **Stale claimed jobs (Finding #3)**: In a 4-worker production setup, any worker crash leaves jobs permanently stuck. Over time, all jobs become unclaimed, and the queue halts.
- **Job ID collisions (Finding #4)**: Unlikely to manifest immediately, but a risk if state is ever reset or corrupted.

### Priority Order

1. **Implement atomic claiming** (Finding #1) — this is the foundation of correctness. Without it, the system is fundamentally broken at scale. Use a lock file or database transaction.
2. **Add error recovery with try/finally** (Finding #2) — ensure complete() runs even if notify fails. Pair with logging (Finding #7) to observe the retry loop.
3. **Add job expiration and monitoring** (Finding #3) — implement a TTL on claimed jobs. Alert if a job stays claimed beyond the TTL (worker crash).
4. **Validate environment at startup** (Finding #6) — fast-fail if PARTNER_WEBHOOK is not set.
5. **Upgrade test suite** (Finding #5) — add concurrency tests to catch race conditions before production.
6. **Improve ID generation** (Finding #4) — switch to a counter or UUID.
7. **Add logging** (Finding #7) — essential for troubleshooting production issues.
8. **Improve error handling in load()** (Finding #8) — log and preserve corrupt state files.

### Coverage Gaps

- **Process manager behavior** — assessment assumes the process manager correctly restarts workers on exit; no verification of restart timing, signal handling, or state between restarts.
- **Network resilience** — no testing of PARTNER_WEBHOOK network timeouts, retries, or degraded partner performance.
- **Concurrent worker load** — no simulation of the full 4-worker production setup under realistic job arrival rates.
- **State file corruption scenarios** — no recovery testing for disk I/O failures, partial writes, or filesystem issues.
- **Large state files** — no performance testing as jobs.json grows; no cleanup strategy for completed jobs.
- **Idempotency of partner notification** — depends on partner behavior (not verified here); if the partner re-processes duplicate notifications, the system amplifies the problem.
