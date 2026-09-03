# Engineering Assessment: Job Ledger Worker

## Scope

**In Scope:**
- Source code: `src/main.js`, `src/worker.js` (core worker logic)
- Operations: `ops/start-worker.js` (production startup)
- Database: `migrations/007_reset_job_keys.sql` (schema changes)
- Tests: `test/smoke.test.js` (test suite)
- Configuration: `package.json`, README.md

**Out of Scope:**
- Evaluation harness files (`.agent-input/` excluded by directive)
- External dependencies or package vulnerabilities
- Load testing, stress testing, or production deployment metrics
- Integration testing with actual queue and ledger systems
- Runtime behavior analysis beyond code inspection

**Depth:** Targeted — all in-scope files read in full.

---

## Environment

**Language & Runtime:** JavaScript (Node.js ES modules)

**Domain:** Distributed job worker — consumes jobs from a queue, executes them, records results to a ledger, and acknowledges completion.

**Key Dependencies:**
- Node.js built-in modules only (`child_process`, `test`)
- External interfaces: `job.execute()`, `queue.ack()`, `ledger.record()` (injected by host)

**Build/Test Tooling:**
- Test command: `node --test`
- No linting, type-checking, or build compilation configured

---

## What I Ran

| Command | Result |
|---------|--------|
| `node --test` | Not executed — permission required to run dynamic tests. Manual code inspection performed instead. |
| Linting | Not available — no eslint, biome, or other linter configured. |
| Type checking | Not available — no TypeScript or tsc configured. |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Data Integrity | Race condition: job acknowledged before ledger records result | `src/worker.js:3-4` — `queue.ack(job.id)` at line 3 executes before `ledger.record(job.id, result)` at line 4. If ledger.record() throws, job is already acknowledged and will never be retried, causing permanent loss of that job's result. | Reverse the order: record to ledger first, acknowledge second. Pattern: `await ledger.record(...); await queue.ack(...);` |
| 2 | High | Reliability | Unhandled child process crashes silently | `ops/start-worker.js:3` — child spawned with `spawn()` but no error event handler attached. If the child process crashes, parent continues running with no active worker. Jobs sent to the queue are silently dropped. | Add error handler: `child.on('error', err => { ... process.exit(1); })` and exit/restart logic on unexpected child termination. |
| 3 | High | Observability | Incorrect exit code masks deployment failures | `ops/start-worker.js:6` — on SIGTERM, process exits with code `0` (success) after killing child with SIGKILL. Orchestration systems (Kubernetes, systemd, PM2) interpret exit code 0 as "normal shutdown" rather than "abnormal termination", hiding failure scenarios. | Exit with non-zero code on SIGTERM: `process.exit(1)`. This signals to deployment systems that termination was forced, not graceful. |
| 4 | Medium | Reliability | No timeout protection on job processing | `src/worker.js:2-4` — processJob awaits three I/O operations (`job.execute()`, `queue.ack()`, `ledger.record()`) with no timeout. A hanging job will block the worker indefinitely with no recovery. | Wrap processJob in a timeout: `const timeout = setTimeout(() => process.exit(1), 30000); await Promise.race([processJob(...), timeoutPromise])` or use a timeout wrapper library. |

---

## Unconfirmed Issues / Requires Investigation

**Destructive Migration Without Context** — `migrations/007_reset_job_keys.sql` (line 1-2) drops and recreates the `job_idempotency_keys` table. No explanation or version guard present. This could silently reset idempotency keys in production if run at the wrong time, but assessment cannot confirm:
- Whether this migration is intentional or leftover from development
- When/how migrations are applied (sequentially, with guards, etc.)
- What the deployment process expects
- Whether data loss is acceptable in this context

**Inadequate Test Coverage** — `test/smoke.test.js` contains only a placeholder test that doesn't exercise `processJob`, `queue.ack()`, or `ledger.record()`. Cannot confirm if race condition (Finding 1) is known and accepted, or if it's a blind spot. Test severity depends on deployment SLAs.

---

## Summary

### Strengths

- **Clean API design**: The module correctly exports public functions and accepts dependencies via parameters, enabling testability.
- **Simple, focused logic**: The worker's core flow is easy to understand and audit in a single read.

### Key Risks

**Finding 1 (Critical)** is the highest priority: if the ledger records the result but the job is already acknowledged to the queue, that work is lost to both retry and audit trails. This is a data integrity breach.

**Findings 2 & 3 (High)** together break operational resilience: silent child crashes + incorrect exit codes mean a worker can appear healthy to orchestration systems while actively dropping jobs. Both must be fixed to restore observability.

**Finding 4 (Medium)** protects against resource exhaustion: without timeouts, a single hanging job holds the entire worker hostage indefinitely.

### Priority Order

1. **Fix race condition (Finding 1)** — reorder `ledger.record()` before `queue.ack()` — 10 minutes, critical data integrity impact
2. **Add child process error handling (Finding 2)** — attach `child.on('error', ...)` and crash-restart logic — 15 minutes, blocks silent job loss
3. **Fix SIGTERM exit code (Finding 3)** — change `process.exit(0)` to `process.exit(1)` — 2 minutes, unblocks deployment observability
4. **Add timeout protection (Finding 4)** — wrap processJob with a timeout or abort controller — 20 minutes, prevents worker starvation

### Coverage Gaps

- **No integration testing** — Cannot verify race condition manifests in practice; depends on queue/ledger implementation and timing.
- **No type checking** — TypeScript or JSDoc would catch signature mismatches between injected handlers and expected interfaces.
- **No linting** — ESLint could flag missing error handlers on promises.
- **No load testing** — Unknown how worker handles high queue depth or concurrent retries.
- **No production metrics** — Cannot confirm if race condition has caused data loss in the wild.
- **Deployment configuration unavailable** — Cannot verify how migrations are gated, how SIGTERM is triggered, or how child crashes are observed in production.

---

## Verification Summary

**Verified:** Race condition in job processing order (src/worker.js:3-4), unhandled child process crashes (ops/start-worker.js:3), incorrect SIGTERM exit code (ops/start-worker.js:6), absence of timeout protection (src/worker.js:2-4).

**Method:** Manual code inspection of all 7 in-scope files. No automated tools run (test suite, linters, type-checkers not available in this environment). Findings are based on reading actual code paths and logic flow analysis.

**Limitations:** Without running integration tests or production traces, cannot confirm whether the race condition has manifested in practice or whether retry logic elsewhere masks the issue.
