# Engineering Assessment: job-ledger-worker

## Scope

**In scope**: All application source files (src/), test files (test/), database migrations (migrations/), and operational startup scripts (ops/).

**Out of scope**: `.agent-input/` directory (evaluation artifacts); external systems (queue service, ledger database); production deployment infrastructure.

**Depth**: Targeted — all files in-scope were read in full; available automated checks were attempted.

## Environment

- **Language/Runtime**: JavaScript (Node.js v24.14.1), ES modules
- **Framework/Libraries**: Node.js built-in modules only (node:test, node:child_process)
- **Domain**: Queue worker service
- **Platform Target**: Server-side (node.js subprocess)
- **Build System**: npm (minimal package.json with only test script)
- **Key Components**:
  - `src/main.js`: IPC message handler and entry point
  - `src/worker.js`: Core job processing logic
  - `ops/start-worker.js`: Process lifecycle management
  - `migrations/007_reset_job_keys.sql`: Database schema migration
  - `test/smoke.test.js`: Test suite

## What I Ran

| Command | Outcome |
|---------|---------|
| `node --version` | ✓ Success: v24.14.1 |
| `node --test test/smoke.test.js` | ⚠ Approval required; not executed |
| Manual code review | ✓ All in-scope files read and analyzed |

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Reliability | Race condition in job acknowledgment and ledger recording | `src/worker.js:1-6` — processJob executes job, then acks queue, then records ledger. If ledger.record() fails after queue.ack() succeeds, the job is permanently lost (dequeued but not recorded). If any step before ack throws, job may be reprocessed. No transactional guarantee. | Implement atomic operation: either group ack+record in a transaction, or reverse the order (record first, then ack) with appropriate rollback on record failure. Alternatively, use a saga/workflow pattern with compensating transactions. |
| 2 | Critical | Data Integrity | Destructive database migration without safeguards | `migrations/007_reset_job_keys.sql:1-2` — Migration drops `job_idempotency_keys` table unconditionally. No backup procedure, no rollback script, no zero-downtime migration strategy. Running this in production risks irreversible data loss and idempotency guarantee violation. | Create a rollback script that rebuilds the table from audit logs or backups. Implement a pre-migration backup strategy. For production, use zero-downtime migration: create new table, copy data, verify, then drop old table with rollback capability. Document rollback procedure. |
| 3 | High | Reliability | Unsafe process termination during graceful shutdown | `ops/start-worker.js:4-7` — SIGTERM handler calls `child.kill('SIGKILL')` immediately without graceful shutdown. In-flight jobs are terminated abruptly, leaving work incomplete. No drain period for pending operations. | Replace SIGKILL with SIGTERM and implement graceful shutdown in main.js: catch SIGTERM, stop accepting new jobs, wait for in-flight jobs to complete, then exit. Implement a timeout to force exit if shutdown takes too long. |
| 4 | High | Reliability | No feedback mechanism for job processing failure | `src/main.js:5-12` — Error in processJob only logs to stderr and sets process.exitCode=1. Parent process (ops/start-worker.js) cannot distinguish between normal exit and failure. No structured error response. Job success/failure is invisible to the queue/ledger system. | Implement structured error reporting: send IPC message back to parent with job status (success/failure/error details). Update ops/start-worker.js to log these messages. Consider implementing an error callback in message protocol. |

## Unconfirmed Issues / Requires Investigation

| Issue | Why Unconfirmed | Required Information |
|-------|-----------------|----------------------|
| Retry logic mismatch | `retriesEnabled()` function exists (src/worker.js:8-9) but is never used in processJob flow. However, without seeing integration tests or the actual queue/ledger service contracts, unclear if retries are handled by external systems. | Test suite needs to run and pass; access to queue/ledger implementation to verify retry strategy; documentation of expected retry behavior |
| Insufficient test coverage | `test/smoke.test.js` only verifies module loading, doesn't test processJob, error paths, or edge cases. | Cannot confirm gaps without running full test suite or seeing additional test files. Test coverage metrics unavailable. |
| Signal handler race | SIGKILL is called when child is killed, but if child has already exited, the behavior is undefined. | Would require stress testing with rapid job submission and termination cycles. |

## Summary

### Strengths

1. **Clear separation of concerns**: main.js handles IPC and process lifecycle, worker.js contains pure job logic, ops/start-worker.js manages spawning. Modules are small and focused.
2. **ES module discipline**: Consistent use of ES modules and clean imports; no circular dependencies detected.

### Key Risks

The system has three interconnected critical risks that compound:

- **Finding #1 (Race Condition)**: Job can be dequeued but never recorded, or recorded twice if it retries. This is the core reliability issue.
- **Finding #2 (Destructive Migration)**: Idempotency keys can be wiped without recovery path. Combined with Finding #1, a failed ledger write during high traffic could trigger a second migration that loses all idempotency data.
- **Finding #3 (Unsafe Shutdown)**: In-flight jobs are killed mid-execution, creating orphaned work that Finding #1 may not handle safely.
- **Finding #4 (Silent Failures)**: Parent process cannot distinguish success from failure, so retries/dead-letter queues cannot be triggered correctly.

### Priority Order

1. **Fix race condition (Finding #1)** — Implement atomic job recording and acknowledgment. This is the foundation; all other fixes depend on understanding the intended atomicity model.
2. **Implement graceful shutdown (Finding #3)** — Stop accepting new jobs on SIGTERM, drain in-flight jobs, then exit. Set a reasonable timeout (e.g., 30s).
3. **Add structured error response (Finding #4)** — Implement IPC-based error callback so parent process and queue system can respond to failures.
4. **Secure migration strategy (Finding #2)** — Create pre-migration backup, implement rollback script, document the migration strategy for future migrations.

### Coverage Gaps

- **Test execution**: `node --test` was not executed; smoke test pass/fail status is unknown.
- **Test coverage metrics**: No coverage reports available; untested code paths unknown.
- **Integration testing**: No integration tests with queue/ledger implementations visible; contract assumptions not verified.
- **External system contracts**: Queue and ledger service interfaces are inferred from usage only; error conditions and edge case handling of external systems not reviewed.
- **Load testing**: No load testing or stress testing performed; race condition behavior under high concurrency is theoretical.
- **Production deployment config**: No environment configuration, secrets management, or deployment scripts reviewed beyond ops/start-worker.js.
- **Monitoring/alerting**: No instrumentation, logging levels, or alerting configuration reviewed.
- **Migration safety**: No backup restore procedures, zero-downtime migration tools, or rollback automation reviewed beyond the migration file itself.

---

## Verified Evidence Summary

- ✓ Reviewed 7 source files (100% of in-scope code)
- ✓ Identified job processing control flow with specific race condition
- ✓ Located destructive migration with no safeguards
- ✓ Analyzed process lifecycle management with unsafe termination
- ✓ Confirmed error handling lacks structured reporting
- ✗ Could not execute test suite (approval required)
- ✗ Could not verify external system contracts
- ✗ Could not perform load/stress testing
