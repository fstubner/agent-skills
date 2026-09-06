# Engineering Assessment: Job Ledger Worker

**Assessment Date**: 2026-09-03  
**Depth Level**: Targeted (all in-scope files read in full)

---

## Scope

**In Scope**:
- Source code: `src/main.js`, `src/worker.js`
- Operations: `ops/start-worker.js`
- Database migrations: `migrations/007_reset_job_keys.sql`
- Tests: `test/smoke.test.js`
- Configuration: `package.json`, `README.md`

**Out of Scope**:
- External queue and ledger implementations (passed as parameters)
- Job implementations (interfaces only)
- Production deployment infrastructure beyond what's in `ops/`
- Load testing, penetration testing, or production performance data
- Docker/container configuration (if any)

**Depth**: **Targeted** — all in-scope files read in full; code patterns analyzed; logical flows traced.

---

## Environment

**Technology Stack**:
- **Language**: JavaScript (ES modules)
- **Runtime**: Node.js (child_process-based spawning)
- **Database**: SQL (migrations present, adapter unknown)
- **Framework/Pattern**: Message-based worker process with IPC
- **Build System**: npm (minimal; test via `node --test`)

**Key Dependencies**:
- None declared in package.json (external queue/ledger provided at runtime)

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` (via `node --test`) | Unable to run — execution permission denied by system |
| `npm run build` | No build script defined in package.json |
| `npm audit` | Unable to run — execution permission denied by system |
| Direct code analysis | ✓ Completed — all 7 files read in full |
| Dependency version check | No package-lock.json or version constraints present |

**Impact**: Automated tests could not be verified; assessment is based on static code analysis only. See Coverage Gaps.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Data Integrity | Destructive migration drops idempotency table unconditionally | `migrations/007_reset_job_keys.sql:1` — `DROP TABLE job_idempotency_keys;` with no conditional, backup, or transaction safety. If this runs while jobs are in flight, idempotency keys are lost. | Add `IF EXISTS` clause. Consider using `TRUNCATE` with explicit migration notes documenting the data-loss intent, or snapshot/restore logic. Wrap migration in a transaction with pre-migration job completion verification. |
| 2 | High | Data Integrity | Non-atomic job processing: ack succeeds but record fails causes result loss | `src/worker.js:2-4` — `queue.ack(job.id)` executes before `ledger.record()`. If `ledger.record()` fails, the job is already removed from the queue but the result is never stored. Exception in main.js:5-11 treats all failures identically, making it impossible to distinguish this failure mode. | Reverse order: record result first (wrapped in a transaction if possible), then ack. If two-phase commit unavailable, add error handling that nacks the job if record fails, or implement idempotent recording. |
| 3 | High | Reliability | Abrupt process shutdown without job completion grace period | `ops/start-worker.js:4-6` — SIGTERM handler calls `child.kill('SIGKILL')` immediately, forcefully terminating the child process. Main.js does not define a SIGTERM handler, so the child has no opportunity to finish the current job. In-flight work is lost. | Send SIGTERM (not SIGKILL) to the child. Add a SIGTERM handler in main.js that sets a flag to stop accepting new messages and allows current job to complete. Implement a timeout (e.g., 30s) in start-worker.js after SIGTERM before escalating to SIGKILL. |
| 4 | Medium | Maintainability | Test suite does not verify job processing logic | `test/smoke.test.js:3-5` — Test only imports the worker module and logs; no assertions or functional tests. Does not verify `processJob` behavior, error handling, queue/ledger interactions, or edge cases (timeout, partial failure). | Add tests for: (a) successful job execution and ack/record sequence, (b) failure scenarios (queue.ack fails, ledger.record fails), (c) job.execute() timeout/hang, (d) retriesEnabled() logic if retry code exists. |

---

## Unconfirmed Issues / Requires Investigation

| Issue | Evidence | What's Needed |
|-------|----------|---------------|
| **Unused or incomplete retry logic** | `src/worker.js:8-10` — `retriesEnabled()` function is exported and logged in main.js:14 but never used in actual retry logic. No retry mechanism visible in `processJob()`. | Confirm whether retry support is intended. If yes, implement retry loop in `processJob()` with exponential backoff. If no, remove dead code. |
| **No timeout on job.execute()** | `src/worker.js:2` — `job.execute()` is awaited with no timeout wrapper. A hanging job will block the worker indefinitely. | Check whether the queue framework provides timeout enforcement or if job execution should have a configurable timeout (e.g., via `Promise.race()` with `setTimeout()`). |
| **Missing parameter validation** | `src/worker.js:1` and `src/main.js:5` — `processJob()` and message handler accept `job`, `queue`, `ledger` without type or capability checks. | Confirm interface contracts: Does job always have an `execute()` method? Do queue/ledger implement `ack()` and `record()`? Add JSDoc or runtime checks if contracts are unclear. |
| **Migration version tracking** | Only one migration file present (`007_reset_job_keys.sql`); no schema version table or migration runner visible in in-scope files. | Verify migration system (external tool, embedded script) has rollback/status tracking. Confirm there is no missing migration history. |

---

## Summary

### Strengths

1. **Minimal, focused code**: The worker module is lean and easy to understand. The single-responsibility design (job execution → ack → record) is conceptually sound, even if the implementation has atomicity issues.
2. **Clear process boundaries**: Use of child_process with IPC and stdio inheritance provides isolation and clean process lifecycle, reducing risk of shared state corruption (though SIGKILL handling undermines this).

### Key Risks

**Deployment & Data Integrity (Critical)**:
- Finding #1: The destructive migration poses an immediate risk during deployments. If run while the worker is processing jobs, idempotency keys are lost and duplicate execution becomes possible.

**Operational Stability (High)**:
- Finding #2 & #3: The combination of non-atomic processing and abrupt shutdown creates a two-vector work loss scenario. A job result can be lost if the ledger is slow, *and* any in-flight job is forcefully terminated on SIGTERM.

**Observability & Confidence (Medium)**:
- Finding #4: The minimal test suite provides no verification that the core job-processing loop works correctly. Combined with generic error handling (Finding #2), it is difficult to diagnose failures in production.

### Priority Order

1. **Fix migration safety** (Finding #1) — Add `IF EXISTS` and document intent. This is the fastest win with the highest blast radius.
2. **Reverse ack/record order or add transactionality** (Finding #2) — The next highest-impact fix: prevents result loss. May require queue/ledger API changes; coordinate with those subsystems.
3. **Implement graceful shutdown** (Finding #3) — Add SIGTERM handler in main.js and increase parent's timeout before SIGKILL. Moderate effort, significant reliability gain.
4. **Add functional tests** (Finding #4) — Low effort, high confidence gain. Test the three-operation sequence under success and failure modes.

### Coverage Gaps

- **Automated test execution**: Tests declared but could not be run; no visibility into test pass/fail status or coverage metrics.
- **Build process**: No build step defined; unclear if there is a transpilation, bundling, or minification step.
- **Error handling analysis**: The error flow of queue/ledger operations is not visible; confirmation of exact failure modes (timeout, network, validation) requires integration with those subsystems.
- **Configuration & runtime context**: No environment variables, feature flags, or configuration schema inspected; `RETRIES_ENABLED` env var referenced but not validated.
- **Dependencies**: No lockfile present; unable to audit transitive dependency versions or known vulnerabilities.
- **Deployment & infrastructure**: No CI/CD pipeline, load testing, or production monitoring data available.
- **IPC/queue framework specifics**: The queue and ledger are injected at runtime; their guarantees (durability, atomicity, timeouts) are not documented in this codebase.

---

## What Was Verified

✓ All source files (`src/`, `ops/`, `migrations/`, `test/`) enumerated and read in full.  
✓ Message-based job flow traced from `start-worker.js` → `main.js` → `worker.js`.  
✓ Migration file analyzed for data safety.  
✓ Error handling in main.js and worker.js reviewed.  
✓ Process lifecycle (SIGTERM, SIGKILL, child.kill) traced.  
✓ Test coverage and logging instrumentation confirmed minimal.

**Summary**: Four high-value confirmed findings identified, all evidence-backed. The codebase is simple and readable but has data integrity and shutdown reliability gaps that should be addressed before production scale-up.
