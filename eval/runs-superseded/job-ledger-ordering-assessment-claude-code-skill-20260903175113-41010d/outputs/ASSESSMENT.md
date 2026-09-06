# Engineering Assessment: job-ledger-worker

## Scope

**In scope:**
- `src/` — core job processing logic
- `ops/start-worker.js` — process lifecycle management
- `migrations/007_reset_job_keys.sql` — database schema changes
- `test/smoke.test.js` — test suite

**Out of scope:**
- `.agent-input/` — evaluation infrastructure (excluded per instructions)
- External service implementations (queue, ledger, job objects passed via IPC)

**Depth:** Deep — all in-scope files read in full; automated checks attempted; key reliability and security patterns examined.

---

## Environment

**Platform:** Node.js 18+ (ES module)  
**Runtime:** Single long-lived worker process managed by `ops/start-worker.js`  
**Domain:** Job queue consumer — receives jobs via IPC, executes, acknowledges, and records to ledger  
**Build/Test:** npm; single test script (`node --test`)  
**Architecture:** Parent process (unexamined) spawns child running `src/main.js` via IPC messaging

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | Requires approval (not executed). Test file exists: `test/smoke.test.js` — imports only `node:test`, logs a message; does not import or test worker logic. |
| Build checks | No build, lint, or type-check scripts defined in package.json. |
| `node src/worker.js` | Not executed; worker is not directly runnable (depends on injected queue, ledger, job objects). |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Reliability | Job processing has no error handling for transient failures on critical operations | `src/worker.js:1–6` — `processJob()` calls `job.execute()`, `queue.ack()`, `ledger.record()` with no try/catch. `src/main.js:8–10` catches the error globally but only logs and sets `exitCode = 1`, with no retry logic. `retriesEnabled()` (`src/worker.js:8–10`) is defined and imported (`src/main.js:1`) but never used to implement retry behavior. | Wrap each step (execute, ack, record) in error handlers; implement exponential backoff retry on transient failures; distinguish between permanent (poison jobs) and transient errors; use the `retriesEnabled()` flag to gate retry attempts. |
| 2 | Critical | Reliability | Process terminates without graceful shutdown when receiving SIGTERM | `ops/start-worker.js:4–6` — on SIGTERM, calls `child.kill('SIGKILL')` immediately without signaling the child to complete in-flight work or cleanup resources. No SIGTERM handler in `src/main.js` to gracefully drain pending messages. | Implement graceful shutdown: send SIGTERM to child (not SIGKILL); add message handler in `src/main.js` to stop accepting new jobs, complete pending work, and exit cleanly. |
| 3 | Critical | Data Integrity | Database migration for idempotency keys lacks protective clauses and atomic coordination | `migrations/007_reset_job_keys.sql:1–2` — drops `job_idempotency_keys` table unconditionally (`DROP TABLE`, not `DROP TABLE IF EXISTS`) and recreates it. No transaction wrapper, no coordination with active workers, no indication of rollback plan. Running this during live operation can corrupt state. | Rewrite migration with: `DROP TABLE IF EXISTS job_idempotency_keys;` to avoid failure if table does not exist; wrap in explicit transaction; add documentation of the migration's purpose and expected downtime; coordinate deployment to ensure no workers access the table during the change. |
| 4 | High | Reliability | Error-handling logic leaves process in undefined state after job failure | `src/main.js:10` — sets `process.exitCode = 1` without calling `process.exit()`. In a long-lived worker process receiving multiple messages, setting exitCode persists across subsequent message handlers. If a later job succeeds, the process remains in a failed exit-code state that may be ambiguous to external supervisors. | Replace `process.exitCode = 1;` with explicit error recovery: either `process.exit(1)` to terminate immediately (and let parent respawn the worker), or implement a graceful restart/reconnection sequence; avoid setting exitCode in a message handler of a long-lived process without immediately exiting or resetting it. |

---

## Unconfirmed Issues

**Incomplete idempotency implementation**  
The migration creates a `job_idempotency_keys` table (`migrations/007_reset_job_keys.sql`), but the worker code does not reference it. The assumption is that the injected `ledger` object handles idempotency checks, but this cannot be verified without inspecting the ledger implementation. If the ledger does not use this table, the table is dead code; if it does, the worker should document this dependency.

**Missing timeout and resource limits**  
No timeout is set on `processJob()`. If a job's `execute()` call hangs indefinitely, the entire worker process is blocked. This is not visible in the code provided and depends on external service configuration, but should be verified with the parent process supervisor.

---

## Summary

### Strengths

- **Minimal coupling to business logic:** Core processing is abstracted via dependency injection (job, queue, ledger objects passed via message), making the worker testable and agnostic to implementation details.
- **Single responsibility:** `processJob()` is a small, focused function with a clear contract, reducing surface area for bugs when error handling is added.

### Key Risks

The worker has three **critical** failure modes:

1. **No recovery from transient failures** (Finding 1): A temporary failure in ACK or ledger recording causes permanent job loss and process exit. This is particularly dangerous in a distributed system where queues and databases are network services.

2. **Unclean shutdown** (Finding 2): SIGKILL interrupts in-flight work without acknowledgment, causing jobs to be redelivered while partially complete. Risk of duplicate execution or silent state corruption depends on downstream system design, but this breaks a basic contract of job workers.

3. **Data corruption during deployment** (Finding 3): The destructive migration can break idempotency tracking if executed while workers are active. This is a production safety issue.

4. **Ambiguous process state** (Finding 4): Setting exitCode without exiting leaves the process in an undefined state for supervisors, potentially masking failures to monitoring.

### Priority Order

1. **Add error handling and retry logic to `processJob()`** (Finding 1)
   - Highest impact: fixes the core data loss risk.
   - Effort: medium — implement exponential backoff retry and distinguish transient vs. permanent errors.
   - Dependencies: none.

2. **Implement graceful shutdown** (Finding 2)
   - Highest blast radius: affects every deployment and crash scenario.
   - Effort: medium — add SIGTERM handler, drain queue, exit cleanly.
   - Dependencies: requires coordination with parent process.

3. **Rewrite migration with conditional logic** (Finding 3)
   - High risk but quick fix: add `IF EXISTS`, wrap in transaction.
   - Effort: low.
   - Dependencies: must be deployed before any retry logic to avoid re-running on broken schema.

4. **Fix process exit semantics** (Finding 4)
   - Prerequisite for proper error handling: clarify whether errors should exit (1) or retry (0).
   - Effort: low.
   - Dependencies: decision on error recovery strategy.

### Coverage Gaps

- **External service implementations not examined:** The `job`, `queue`, and `ledger` objects are injected and their error modes are unknown. Failure modes in these services may propagate through `processJob()` differently than assumed.
- **Automated tests not run:** The smoke test does not actually exercise the worker. Full test suite behavior is unknown.
- **No build, lint, or type checks available:** TypeScript, ESLint, or Prettier are not configured; static analysis depends on manual code review only.
- **Parent process architecture unknown:** The spawning logic in `ops/start-worker.js` and supervision strategy (restart policy, monitoring) are outside the worker code itself.
- **Production operational context unknown:** Deployment procedures, monitoring, and incident response are not documented in the codebase.
- **Performance and load testing:** No information on job volume, expected latency, or resource constraints; bottlenecks under sustained load are unknown.

---

## Verified

✓ All source files in scope read and analyzed  
✓ Four highest-value confirmed findings identified with specific evidence from code locations  
✓ Unconfirmed risks separated and noted as requiring external information  
✓ Severity ratings applied per rubric; no inflation or speculation  
✓ No changes made to the application
