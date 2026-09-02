# Job Worker Assessment

## Scope

**In scope**: Complete worker implementation including job queue management (`src/queue.js`), billing notifications (`src/notify.js`), and main worker loop (`src/worker.js`). Test suite in `test/queue.test.js`.

**Out of scope**: Partner webhook implementation, process manager behavior, production deployment infrastructure, billing reconciliation logic.

**Depth**: Targeted — all in-scope files read in full.

---

## Environment

**Language and runtime**: JavaScript (Node.js v24.14.1)

**Domain**: Job queue worker system; processes jobs and notifies external billing partner

**Build system**: npm (ES modules)

**Key concern**: This worker runs 4 concurrent instances in production. Concurrent access to shared state is critical.

---

## What I Ran

| Command | Result |
|---------|--------|
| `node --version` | v24.14.1 (success) |
| `npm test` | Approval required to run; test structure verified manually |
| Build check | No build step declared in package.json |
| Lint check | No linter configured |
| Type check | No TypeScript; runtime-only validation |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | Race condition in job claiming with multiple workers | `src/queue.js:23-29` — `claimNext()` loads state, finds unclaimed job, then saves updated state in two separate operations. Between load and save, another worker can claim the same job. | Implement atomic compare-and-swap or file locking. Alternative: use a database with transaction support or add a simple advisory lock file. For interim: mutex library with file-based locking. |
| 2 | High | Reliability | Billing notification not idempotent; inconsistent state between local and partner | `src/worker.js:7-8` — `notifyPartner()` is called before `complete()`. If notify succeeds but complete fails (or crashes between them), the job is marked done locally but partner may have been notified; if notify fails but process crashes, job is claimed but never marked done, and partner is never notified. | Move `complete()` before `notifyPartner()` (unlikely to fail), or implement idempotent notifications with a "notification sent" flag in state. Safer: don't mark done until partner confirms. Or: implement two-phase commit or at-least-once delivery semantics. |
| 3 | High | Reliability | No timeout on external API call to billing partner | `src/notify.js:5-9` — `fetch()` has no timeout. If partner webhook hangs, the worker hangs indefinitely, consuming a worker slot and causing cascading failures. With 4 workers, one slow API can bring down the entire system. | Add a `timeout` option to the fetch call: `{ ..., signal: AbortSignal.timeout(5000) }` (or use a third-party timeout utility for older Node versions). Set timeout based on SLA (typical: 5-30 seconds). |
| 4 | High | Reliability | Unhandled promise rejection in worker loop | `src/worker.js:4-9` — If `notifyPartner()` throws, `runOnce()` throws and the worker dies. With process manager restarts, the job remains claimed but not done, causing it to stall indefinitely. Claimant is never released. | Catch errors in `notifyPartner()` or complete step; decide on retry strategy (retry immediately, delay, give up after N attempts, put in dead-letter queue). For now: wrap the notify call in try-catch and return early (or re-throw with a flag). |
| 5 | Medium | Data Integrity | No validation on JSON file corruption | `src/queue.js:6-7` — If `.data/jobs.json` is corrupted (truncated, invalid JSON), the catch silently returns an empty queue. This loses all job state. | Add logging when catch triggers. Consider writing to a backup before overwriting. For production: switch to a database. For now: validate JSON.parse result before using. |
| 6 | Medium | Architecture | No locking mechanism for file-based state | `src/queue.js:1-13` — Multiple workers read and write `.data/jobs.json` concurrently with no synchronization. Even within a single operation (e.g., `claimNext`), the file can be modified by another worker between load and save. | Add file-level locking (fcntl/flock equivalent for Node: use `proper-lockfile` or `fs.lock` if available). Or: switch to a database with row-level locking. Or: use a single-threaded queue service (Redis, RabbitMQ). |
| 7 | Medium | Maintainability | Test coverage does not include concurrent access patterns | `test/queue.test.js:5-10` — Single test covers happy path only (one job, one worker). Does not test: two workers claiming same job, job claimed while being completed, corrupted state recovery, network failures during notification. | Add tests for: (a) two concurrent `claimNext()` calls; (b) `claimNext()` immediately followed by `complete()` from different workers; (c) state recovery from corrupted JSON; (d) `notifyPartner()` failures (mock with timeout/error). Recommend using `node:test` with `beforeEach` to reset state. |
| 8 | Medium | Reliability | No retry logic for transient partner failures | `src/notify.js:10` — If the billing partner returns 500 or network times out (before timeout fix), the job is not completed and will be reprocessed. But there is no exponential backoff or retry limit, risking: duplicate notifications (if partner idempotency is weak), rapid re-queuing, worker thrashing. | Implement retry logic with exponential backoff (e.g., retry up to 3 times with 1s, 2s, 4s delays). If all retries fail, mark job as "notify-failed" and alert ops. Partner should implement idempotency (job ID as idempotency key). |

---

## Unconfirmed Issues

**Race condition severity confirmation**: The race condition in `claimNext()` is theoretically possible and affects the core contract (4 workers, each should process distinct jobs). However, without running the tests or a concurrent stress test, the probability in production is not quantified. Likely depends on clock skew between workers and filesystem performance. Recommend: run the test suite with concurrent workers and verify.

---

## Summary

### Strengths

1. **Clean separation of concerns** — Worker, queue, and notification logic are in separate modules, making testing and changes easier.
2. **Simple API** — The three queue functions (`enqueue`, `claimNext`, `complete`) are clear and easy to understand.

### Key Risks

- **Critical**: Race condition (Finding #1) means the fundamental guarantee — that each worker processes distinct jobs — is violated. In production with 4 concurrent workers, jobs can be claimed by multiple workers, causing duplicate work and billing errors.
- **High**: Billing notification inconsistency (Finding #2) creates financial risk. The system can notify the partner that a job is done without marking it locally, or vice versa, leading to billing discrepancies or refund disputes.
- **High**: Missing timeout on partner webhook (Finding #3) creates operational risk. One slow or hanging webhook can exhaust all 4 worker slots.

### Priority Order

1. **Add timeout to `fetch()` in `notify.js`** (Finding #3) — Quick fix, high impact. 15 minutes.
2. **Implement atomic job claiming** (Finding #1) — Use file locking library (`proper-lockfile`) or simplest: add a `.lock` file write as part of save. 1-2 hours.
3. **Fix notification/completion order and add error handling** (Finding #2, #4) — Wrap `notifyPartner()` in try-catch; decide on retry strategy. 1 hour.
4. **Add retry logic for transient failures** (Finding #8) — Exponential backoff on partner errors. 2-3 hours.
5. **Expand test suite** (Finding #7) — Add concurrent access and failure scenario tests. 2-3 hours.
6. **Switch to a database** — Long-term. File-based concurrency is not scalable. Consider PostgreSQL with `SERIALIZABLE` isolation or Redis. 1-2 days design + implementation.

### Coverage Gaps

- **Not examined**: Partner webhook behavior (response codes, idempotency requirements, error patterns, timeouts on their end).
- **Not examined**: Process manager restart behavior (what happens when a worker crashes? Does it restart immediately? After delay?).
- **Not examined**: Job volume, latency, and throughput expectations (determines what "timeout" value is acceptable).
- **Not examined**: Production logs, metrics, or incident history (no access to runtime behavior or known issues).
- **Not examined**: Deployment configuration (environment variables, `.data` directory persistence, backup strategy).
- **Tool not run**: `npm test` requires approval but single test covers only happy path; concurrent stress test would reveal race condition severity.
- **Not examined**: Scaling behavior (does the JSON file become a bottleneck as job volume increases? What is the file size / read-write latency at scale?).
