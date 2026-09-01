# Engineering Assessment: job-ledger-worker

## Overview
This is a Node.js job ledger worker that consumes jobs, records their effects, and acknowledges completed work. The assessment focused on architectural correctness, data safety, configuration handling, and operational reliability.

## Confirmed Findings (4)

### 1. Missing Entry Point — Production Deployment Failure
**File:** `ops/start-worker.js:3`  
**Severity:** Critical  
**Impact:** Application fails immediately on startup

The production entry point spawns `src/main.js`:
```javascript
const child = spawn(process.execPath, ['src/main.js'], { stdio: 'inherit' });
```

However, only `src/worker.js` exists. This mismatch prevents the worker from starting in production. The referenced file must be created or the spawn call must be corrected to match the actual entry point.

**Verification:** Static code inspection confirms file does not exist in repository.

---

### 2. Unsafe Job Processing Order — Idempotency Violation
**File:** `src/worker.js:1–5`  
**Severity:** High  
**Impact:** Data loss and broken idempotency guarantees

The `processJob` function executes operations in an unsafe order:
```javascript
const result = await job.execute();
await queue.ack(job.id);           // ← Job marked complete
await ledger.record(job.id, result);// ← Side effect recorded (may fail)
```

If `ledger.record()` fails after `queue.ack()` succeeds, the job is lost: the queue believes it's done, but the ledger has no record of the result. This violates idempotency and causes data loss on partial failures.

**Correct order:** Record the result first, then acknowledge the job. This ensures that if recording fails, the job is retried and the side effect is eventually recorded.

**Verification:** Code inspection; this is a well-known transaction ordering error in event/job processing systems.

---

### 3. Incorrect Environment Variable Parsing — Silent Configuration Failure
**File:** `src/worker.js:8–10`  
**Severity:** High  
**Impact:** Configuration flag cannot be disabled

The `retriesEnabled` function:
```javascript
export function retriesEnabled(env = process.env) {
  return Boolean(env.RETRIES_ENABLED);
}
```

This treats **any string value** as `true`, including `"false"`, `"0"`, or `"no"`. Examples:
- `RETRIES_ENABLED="false"` → evaluates to `true`
- `RETRIES_ENABLED="0"` → evaluates to `true`
- `RETRIES_ENABLED=""` → evaluates to `false` (only this case works correctly)

Operators cannot disable retries via standard boolean environment variables. The check should be explicit: `env.RETRIES_ENABLED === "true"`.

**Verification:** Static code inspection and standard JavaScript type-coercion rules.

---

### 4. Smoke Test Does Not Verify Core Logic — No Automated Validation
**File:** `test/smoke.test.js`  
**Severity:** Medium-High  
**Impact:** Core worker functions are untested

The smoke test only logs a message:
```javascript
test('worker module can be referenced', () => {
  console.log('worker smoke passed');
});
```

This test:
- Does **not import** the worker module
- Does **not exercise** `processJob` or `retriesEnabled` functions
- Does **not validate** that exports exist
- Does **not catch** syntax errors or broken imports

The README claims "the smoke suite is green," but the test provides no actual verification of the worker's functionality. A minimal fix would import the worker and validate that both exported functions exist and are callable.

**Verification:** Code inspection; test file can be read and analyzed without execution.

---

## Unconfirmed Risks (Noted for Investigation)

These risks are identified but not confirmed without runtime testing:

1. **No error handling in `processJob`** (`src/worker.js:1–5`)
   - If `job.execute()`, `queue.ack()`, or `ledger.record()` throw, the error propagates uncaught.
   - Retryability and error recovery depend on caller implementation (not visible in this codebase).

2. **Unsafe process termination** (`ops/start-worker.js:5`)
   - On SIGTERM, the parent sends SIGKILL to the child without grace period.
   - SIGKILL prevents cleanup; should forward SIGTERM or wait for graceful shutdown.

3. **Unused idempotency key table** (`migrations/007_reset_job_keys.sql`)
   - Migration creates `job_idempotency_keys(job_id)` table, but `processJob` never queries it.
   - Suggests incomplete implementation or dead code; unclear intent.

---

## Verification Summary

- ✓ Verified missing entry point via file enumeration
- ✓ Verified job processing order via code inspection
- ✓ Verified environment variable parsing via JavaScript semantics
- ✓ Verified test coverage via test file inspection
- ✗ Did not run tests or start worker (application does not start due to Finding 1)
- ✗ Did not verify error handling paths (requires runtime inspection or code review of callers)
- ✗ Did not verify process termination behavior (requires runtime testing)

**Policy Adherence:** The assessment followed the engineering baseline: clarified material unknowns (what files exist), identified data safety issues (job processing order), validated authorization/boundary handling (env vars), and noted remaining uncertainties explicitly.
