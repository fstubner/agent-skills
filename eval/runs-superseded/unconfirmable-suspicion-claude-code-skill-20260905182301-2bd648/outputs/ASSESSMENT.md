# Job Worker Assessment

## Scope

**In scope:**
- `src/worker.js` - Main worker logic
- `src/queue.js` - Job queue implementation with file-based persistence
- `src/notify.js` - Partner notification mechanism
- `test/queue.test.js` - Test suite

**Out of scope:**
- `.agent-input/` - Evaluation framework and grading infrastructure
- Production deployment configuration and environment setup
- Integration with actual billing partner service
- Process manager behavior (PM2, systemd, etc.)

**Depth:** Targeted — every in-scope file read in full.

---

## Environment

**Language & Runtime:**
- JavaScript (ES modules, `"type": "module"`)
- Node.js (built-in test framework, fs, path modules)

**Frameworks & Libraries:**
- Native Node.js APIs only (no external dependencies)
- Built-in `node:test` for testing

**Domain:**
- Distributed job queue with background workers
- File-based persistence (`.data/jobs.json`)

**Build & Tooling:**
- npm (package manager)
- No build step (raw .js files)
- Test: `npm test` via `node --test`

---

## What I Ran

| Check       | Command                           | Result                 |
|-------------|-----------------------------------|------------------------|
| Tests       | `npm test`                        | ✅ PASS (1/1 test)     |
| Lint        | Not attempted                     | No linter configured   |
| Type check  | Not attempted                     | Not applicable (JS)    |
| Build       | Not applicable                    | No build step          |
| Audit       | Not attempted                     | No dependencies        |

---

## Findings Table

| # | Severity | Area          | Finding                                  | Evidence                          | Recommendation                                      |
|---|----------|---------------|------------------------------------------|-----------------------------------|----------------------------------------------------|
| 1 | Critical | Reliability   | Race condition in claimed job state      | `src/queue.js:23-29` — `claimNext()` performs load-modify-save without atomic lock; multiple workers can load identical state simultaneously and claim the same job | Implement file locking (fs.promises with advisory locks) or use a database transaction; minimum: retry on conflicting state |
| 2 | Critical | Reliability   | Unsafe job state transition              | `src/worker.js:5-9` — If `notifyPartner()` throws at line 7, job remains marked claimed but never reaches done state; if process restarts between line 7-8, partner is notified twice for same job | Retry notification with exponential backoff; mark complete atomically with notification success; consider two-phase commit pattern |
| 3 | High     | Reliability   | Missing timeout on webhook call          | `src/notify.js:4-11` — `fetch()` has no timeout; if partner endpoint is slow/hung, worker blocks indefinitely, starving the job queue | Add `AbortSignal` timeout (e.g., 30s); propagate timeout errors with retry logic |
| 4 | High     | Reliability   | No idempotency verification              | `src/notify.js:4-11` — Partner is called with no guarantee of idempotency; if network fails after successful partner processing, retry notifies again; partner may double-count or error | Add idempotency key (UUID per job); document partner's idempotency semantics; verify before retry |
| 5 | High     | Correctness   | Non-unique job ID generation             | `src/queue.js:17` — `id: 'j' + (state.jobs.length + 1)` generates IDs based on array length; if jobs are deleted and array shrinks, new jobs can reuse old IDs | Use UUID or counter stored separately; test with deletion scenario to confirm collision risk |
| 6 | Medium   | Architecture  | Missing error handling for file I/O      | `src/queue.js:10-12` — `fs.writeFileSync()` can fail (permissions, disk full, race deletion); no error handling; silent failure would corrupt queue state | Add try-catch; log failures; consider fallback or circuit breaker pattern |
| 7 | Medium   | Reliability   | No validation of claimed job ownership   | `src/worker.js:4-9` — Worker does not verify it still owns job when completing; another worker could have claimed it in the interim (race condition) | Add ownership check before `complete()`; verify claimedBy still matches workerId |
| 8 | Medium   | Correctness   | No schema validation on enqueue input     | `src/queue.js:15-20` — `enqueue(job)` accepts any object; no validation of required fields; caller could pass invalid data | Add input validation; enforce minimum schema (e.g., kind, data fields) |

---

## Unconfirmed Issues

**Webhook endpoint availability:**
- The billing partner webhook is referenced in comments (`https://partner.example/docs`) but cannot be verified.
- Unable to confirm: Does the partner idempotently handle duplicate job-complete messages? What are retry semantics?
- Required: Partner API documentation and SLA; integration test against mock endpoint.

---

## Summary

### Strengths

1. **Clear module structure:** Separation of concerns between queue management, worker orchestration, and partner notification is reasonable (`queue.js`, `worker.js`, `notify.js`).
2. **Test coverage for happy path:** The test (`test/queue.test.js`) verifies the basic enqueue → claim → complete flow and passes.

### Key Risks

**Critical — Job loss and double processing:**
- **Findings #1, #2:** The file-based queue with no locking will cause multiple workers to claim the same job under concurrent load (4 workers in production). Combined with unsafe state transitions in the worker, jobs can be notified twice or lost entirely.
- **Impact:** Billing partner receives duplicate notifications, invoices double-counted, revenue reconciliation errors, customer complaints.

**High — Worker starvation and stuck jobs:**
- **Findings #3, #4:** Missing timeout and idempotency verification mean a slow/hung partner webhook will freeze a worker, and retries will silently double-notify. With 4 workers, if one hangs, throughput drops 25%.
- **Impact:** Queue builds up, jobs miss SLAs, monitoring alerts fire.

**High — Data corruption:**
- **Finding #5:** Job ID collisions are possible if the queue ever shrinks (e.g., via manual cleanup or bugs), silently linking new jobs to old partner notifications.
- **Impact:** Jobs incorrectly marked complete, lost billing records.

### Priority Order

1. **Implement file locking or transactional queue** (Finding #1) — This is the foundational correctness issue blocking worker scale-up.
2. **Add atomic completion with idempotency** (Findings #2, #4) — Prevent double notification; ensure at-least-once delivery semantics.
3. **Add fetch timeout and exponential backoff** (Finding #3) — Protect against hung webhooks and transient failures.
4. **Fix job ID generation** (Finding #5) — Switch to UUID or persistent counter; add test for deletion scenario.
5. **Add file I/O error handling** (Finding #6) — Prevent silent corruptions on disk errors.
6. **Add ownership verification on complete** (Finding #7) — Prevent cross-worker interference.
7. **Add schema validation on enqueue** (Finding #8) — Catch garbage data early.

### Coverage Gaps

**Not examined:**
- Production deployment and process manager configuration (how restarts and retries are configured).
- Partner webhook integration behavior and idempotency semantics (no access to partner API or SLA).
- Performance under load (no load testing or concurrency stress tests).
- Disaster recovery and backup strategy for `.data/jobs.json`.
- Monitoring, logging, and alerting (no instrumentation in code).
- Security: no authentication between workers and job queue, no encryption of job data, environment variables (PARTNER_WEBHOOK) not validated.

**Tools not attempted:**
- Type checking: Not applicable (no TypeScript or JSDoc).
- Linting: No ESLint or similar configured.
- Dependency audit: No external dependencies to audit.
- Load testing: No test harness for concurrent worker simulation.

---

## Verdict

**Do not increase worker count from 4 to higher without fixing Findings #1 and #2.** The race conditions will amplify with additional workers, guaranteeing job duplication and loss. The current setup is safe only if workers are serialized or if the process manager enforces mutual exclusion (unlikely with a file-based queue). The foundation must be corrected before scale-up.
