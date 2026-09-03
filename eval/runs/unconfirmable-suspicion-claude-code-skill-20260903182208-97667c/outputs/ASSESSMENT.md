# Job Worker Assessment

## Scope

**In scope:**
- `src/worker.js` — main worker orchestration
- `src/queue.js` — job queue management (file-based persistence)
- `src/notify.js` — partner notification integration
- `test/queue.test.js` — unit tests

**Out of scope:**
- `.agent-input/` directory and evaluation configuration
- External deployment or infrastructure setup
- Process manager configuration (mentioned in README but not present in workspace)

**Depth:** Targeted (all in-scope files read in full; automated checks attempted but could not run due to tool restrictions)

---

## Environment

**Languages and runtimes:**
- JavaScript (ES modules)
- Node.js v24.14.1

**Frameworks and libraries:**
- Node.js built-in modules only: `fs`, `path`, `node:test`, `node:assert`
- Fetch API (built-in to Node.js 18+)

**Domain:**
- Background job worker / queue processor
- Multi-worker architecture (4 workers in production per README)

**Build and tooling:**
- No build step declared
- Test: `node --test test/queue.test.js`
- No lint, format, or audit tooling configured

---

## What I Ran

| Command | Result |
|---------|--------|
| `node --version` | v24.14.1 — successfully determined runtime |
| `npm test` | Tool requires approval; not executed |
| `npm audit` | No audit script in package.json; npm audit would require internet access |
| Lint/format checks | No tooling configured; none attempted |

**Note:** The test command (`node --test test/queue.test.js`) requires elevated permissions in this environment and could not be executed. Test results are therefore reported as unavailable.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Correctness | Race condition in job claiming | `src/queue.js:23-29` — `claimNext()` loads state, finds job, modifies in memory, then saves. Between load and save, another worker could claim the same job. No atomic operation or file locking. | Implement atomic read-modify-write with file locking (e.g., `fs.promises` with lock file, or switch to a database with transactions). For 4 concurrent workers, this is a data integrity failure. |
| 2 | **Critical** | Reliability | Job notification without transactional guarantee | `src/worker.js:4-10` — workflow is: claim job → notify partner → mark done. If `notifyPartner()` succeeds but `complete()` never runs (e.g., process crash between lines 7-8), the partner is told the job is done but the queue still shows it claimed. Conversely, if `complete()` is called but the network request fails and retries via process restart, the job is claimed again but the partner already received it once (idempotency not checked). | Implement idempotent job completion: (a) query partner to confirm if job was already notified, or (b) only mark done *before* notification (accept partner retry risk), or (c) use distributed transaction / saga pattern. Current design is vulnerable to duplicate notifications or silent loss. |
| 3 | **High** | Reliability | Missing error handling for environment variable | `src/notify.js:5` — `process.env.PARTNER_WEBHOOK` is used directly without validation. If not set, `fetch()` will attempt `POST ${undefined}/job-complete`, resulting in a malformed URL and a confusing error. | Validate `PARTNER_WEBHOOK` at startup (e.g., in worker initialization): `if (!process.env.PARTNER_WEBHOOK) throw new Error('PARTNER_WEBHOOK not set');` |
| 4 | **Medium** | Reliability | Silent file system errors on queue corruption | `src/queue.js:6-7` — `load()` catches all errors and returns `{ jobs: [] }`. If `jobs.json` is corrupted (invalid JSON, partial write, etc.), the queue silently resets. This loses all job state without warning or logging. | Separate recoverable errors (file not found) from corruption errors (invalid JSON). Log the corruption and either fail loudly or implement a backup rotation strategy. Example: `const data = JSON.parse(...); } catch(e) { if (e instanceof SyntaxError) { throw new Error('jobs.json corrupted'); } return { jobs: [] }; }` |
| 5 | **Medium** | Architecture | No mechanism to prevent duplicate worker IDs | `src/queue.js:23-29` — `claimNext(workerId)` accepts any string as worker ID without validation. If two processes use the same `workerId`, they will mutually interfere. The README states "we run four workers in production" but there is no enforcement or registration of worker identity. | Assign unique, immutable worker IDs at startup (e.g., via environment variable + validation, or a registration service). Validate that each claimed job records a distinct worker ID. |
| 6 | **Medium** | Maintainability | Test coverage does not exercise concurrency | `test/queue.test.js:5-10` — Test only covers single-threaded happy path (enqueue, claim, complete sequentially). No tests for: race conditions in `claimNext()` with concurrent workers, error handling in `notifyPartner()`, file system failures, environment variable validation. | Add tests: (a) concurrent `claimNext()` calls should not return the same job twice, (b) `notifyPartner()` with missing PARTNER_WEBHOOK, (c) `notifyPartner()` with network errors, (d) corrupted `jobs.json`. For concurrent tests, use `Promise.all()` or `worker_threads` to simulate multiple workers. |

---

## Unconfirmed Issues

**Partial write recovery:** `fs.writeFileSync()` in `save()` is atomic on most file systems, but on network-mounted storage or under specific crash scenarios (mid-write + power loss), the file could be left in an inconsistent state. Could not verify the deployment environment or file system type. If jobs.json is on NFS or similar, recommend `fs.promises.writeFile()` with explicit temp-file-then-rename pattern.

**Partner webhook retry semantics:** The README states retries are handled by the process manager (restart on throw), but it is unclear whether the billing partner's endpoint is idempotent or how it handles duplicate job-complete notifications. If the partner's endpoint is *not* idempotent and we notify twice (due to a race), we could double-charge or double-process. Recommend: (a) confirm partner's idempotency guarantees, or (b) implement client-side deduplication tracking.

---

## Summary

### Strengths

1. **Simple, readable code structure** — Three focused modules with clear responsibilities (queue, notify, worker orchestration). No external dependencies or complex frameworks to audit. Easy to understand the happy path.

2. **Graceful startup fallback** — `load()` handles missing queue file by returning an empty queue, allowing the worker to start up without manual file setup.

3. **Non-blocking async notifications** — `notifyPartner()` is correctly async, so blocking network latency does not pause job processing.

### Key Risks

**Critical Issues (must fix before scaling to 4+ workers):**
- **Race condition in `claimNext()`** (Finding #1): Multiple workers can claim the same job. This is a **correctness failure** that will cause jobs to be processed multiple times or skipped entirely under concurrent load. The current test suite does not expose this because it is single-threaded.
- **Transactional gap between notify and complete** (Finding #2): A crash between notification and job completion creates divergence: either the partner is told the job is done but the queue forgets it was claimed, or vice versa. Duplicate notifications are possible.

**High-Risk Issues:**
- **Missing environment validation** (Finding #3): Worker crashes if `PARTNER_WEBHOOK` is not set, with a confusing error message.

**Medium-Risk Issues:**
- Silent file corruption recovery (Finding #4)
- No worker ID uniqueness enforcement (Finding #5)
- No concurrency testing (Finding #6)

### Priority Order

1. **Implement atomic job claiming** (Fix #1) — Non-negotiable for correctness under 4 concurrent workers. Add file-based locking or switch to a durable queue (Redis, database). *Severity: Critical; Fix effort: 2–4 hours.*

2. **Add transactional semantics or idempotency** (Fix #2) — Prevent data divergence between job queue and partner notifications. *Severity: Critical; Fix effort: 2–4 hours.*

3. **Validate PARTNER_WEBHOOK on startup** (Fix #3) — Fail fast with a clear error message. *Severity: High; Fix effort: 15 minutes.*

4. **Improve error handling on queue corruption** (Fix #4) — Log, monitor, or backup corrupted state. *Severity: Medium; Fix effort: 1 hour.*

5. **Add worker ID validation** (Fix #5) — Enforce unique, immutable worker identities. *Severity: Medium; Fix effort: 30 minutes.*

6. **Add concurrency tests** (Fix #6) — After #1 and #2 are fixed, verify with concurrent test cases. *Severity: Medium; Fix effort: 2 hours.*

### Coverage Gaps

- **Test execution:** The test command (`node --test`) could not be executed in this environment due to tool permission restrictions. Actual test pass/fail status is unknown.
- **Lint and format checks:** No linter or formatter is configured (no eslint, prettier, etc.). Static analysis tools were not run.
- **Dependency audit:** `npm audit` was not run (no external dependencies, so vulnerability surface is low).
- **Load testing:** No performance testing was performed. Throughput under 4+ workers is unknown.
- **Network fault injection:** No testing of partner webhook timeouts, 5xx errors, or network partition scenarios.
- **Deployment and runtime environment:** Process manager configuration, environment variable setup, file system type (local vs. network storage), and production behavior are outside this workspace and were not examined.
- **Partner API contract:** The partner endpoint's idempotency, retry behavior, and rate limits are only documented by a URL reference (`https://partner.example/docs`), which is not accessible.

---

## Verdict

**The codebase is not ready to support 4 concurrent workers without critical fixes.** The race condition in `claimNext()` and the transactional gap between notification and job completion will cause data loss, duplicate processing, or silent failures under concurrent load. The existing test suite does not catch this because it is single-threaded.

**Recommendation before increasing worker count:** Complete fixes #1 and #2 above, add concurrent test coverage, and validate against partner idempotency semantics.
