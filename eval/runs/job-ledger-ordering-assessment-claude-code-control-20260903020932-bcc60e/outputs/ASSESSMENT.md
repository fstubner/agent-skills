# Engineering Assessment: Job Ledger Worker

## Summary

This assessment covers a 36-line Node.js job processing worker. The codebase exhibits critical issues with job durability and error handling that could lead to job loss and silent failures in production.

## Confirmed Findings

### 1. Critical: Race condition between queue acknowledgment and ledger recording

**Location**: `src/worker.js:3-4`

**Issue**: The `processJob` function acknowledges the job in the queue before recording its result in the ledger:
```javascript
await queue.ack(job.id);        // Job removed from queue
await ledger.record(job.id, result);  // But not guaranteed to complete
```

**Failure scenario**: If the process crashes, network fails, or `ledger.record()` throws after `queue.ack()` succeeds, the job is permanently lost. The queue considers it completed, but the ledger has no record of it.

**Impact**: Violates the durability guarantee required for reliable job processing. Results in untracked completed work and inability to audit or recover job execution history.

**Correct pattern**: Record first, then acknowledge. This ensures the ledger is always the source of truth.

---

### 2. Critical: No error recovery for failed job execution

**Location**: `src/main.js:6-11`

**Issue**: The process catches job failures but takes no action to return the job to the queue for retry:
```javascript
try {
  await processJob(job, queue, ledger);
} catch (error) {
  console.error('job failed', error);
  process.exitCode = 1;  // Only exits; doesn't nack the job
}
```

**Failure scenario**: When `processJob()` throws (e.g., `job.execute()` fails), the worker logs the error and exits. The queue doesn't receive a negative acknowledgment (nack), so the job is not retried. The work is silently lost.

**Impact**: Jobs that fail due to transient errors are never retried. Failures are only visible in logs that may not be monitored. No dead-letter queue or alerting mechanism exists.

---

### 3. High: Ungraceful child process termination

**Location**: `ops/start-worker.js:4-6`

**Issue**: The SIGTERM handler kills the child process with SIGKILL without allowing graceful shutdown:
```javascript
process.on('SIGTERM', () => {
  child.kill('SIGKILL');  // Immediate termination
  process.exit(0);        // Parent exits without waiting
});
```

**Failure scenario**: A job received by the worker but not yet acknowledged is abruptly terminated. No cleanup occurs. In-flight jobs may be partially processed, and the ledger may be left in an inconsistent state if a write was in progress.

**Impact**: Prevents graceful shutdown, risks data loss, and makes deployments less safe. The parent doesn't wait for the child to exit, so buffered logs or final cleanup may not complete.

---

### 4. High: Missing input validation in job processing

**Location**: `src/worker.js:1-5`

**Issue**: The `processJob` function assumes all parameters are valid without validation:
```javascript
export async function processJob(job, queue, ledger) {
  const result = await job.execute();
  // No checks that job.id, queue, or ledger exist
  await queue.ack(job.id);
  await ledger.record(job.id, result);
}
```

**Failure scenario**: If `job` is null, `queue` is undefined, or `job.id` is missing, the function fails with cryptic errors (e.g., "Cannot read property 'id' of undefined") rather than clear validation errors. A malformed message from the queue crashes the worker silently.

**Impact**: Reduced debuggability. Type assumptions fail at runtime without informative error messages. Makes production troubleshooting harder.

---

## Unconfirmed Risks

- **Timeout handling**: No timeout enforced on `job.execute()`. A job could hang indefinitely, consuming worker resources. Confirmation would require understanding the job execution model.

- **Message passing reliability**: The IPC channel between parent and child (`process.on('message')`) has no heartbeat or error handling. Worker process death is not detected by the parent. Confirmation would require integration testing with the parent process.

- **Test coverage**: The smoke test only imports the module and logs a message. It provides no coverage of actual job processing logic, error cases, or the order of operations. Real testing exists elsewhere, not confirmed here.

---

## What Was Verified

- Examined all six source files (2 application modules, 1 ops script, 1 test, 1 migration, 1 config)
- Traced the complete job processing flow from main.js → worker.js → queue/ledger operations
- Analyzed error paths and process lifecycle management
- Confirmed the ack/record ordering issue and its durability implications
- Verified the absence of error recovery and validation guards
