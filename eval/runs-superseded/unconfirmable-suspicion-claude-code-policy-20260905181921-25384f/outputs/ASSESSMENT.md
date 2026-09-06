# Job Worker Assessment

**Status: NOT READY FOR SCALE**  
Current system safely runs 4 workers. Scaling up is unsafe without addressing critical concurrency and failure-handling issues.

---

## Critical Issues

### 1. Race Condition in Job Claiming

**Severity: HIGH**

The `claimNext()` function has a classic read-modify-write race:
```
Worker A reads jobs.json → finds unclaimed job
Worker B reads jobs.json → finds same unclaimed job
Worker A writes job claimed by A
Worker B writes job claimed by B → overwrites A's change
```

**Consequence:** Multiple workers claim and process the same job. Partner receives duplicate notifications. Work is duplicated or lost.

**When it fails:** With 4 workers, probability of collision is low but non-zero. With 8+ workers, collisions become likely within hours of operation.

**Evidence:** `queue.js:23-29` has no atomic read-modify-write. File-based storage has no locking primitive.

---

### 2. Deadlocked Jobs After Partner Notification Failure

**Severity: HIGH**

If `notifyPartner()` succeeds but then:
- The connection closes before response is received
- `complete()` crashes
- Worker process crashes between notify and complete

The job is **permanently stuck** in "claimed but not done" state:
- `claimNext()` won't re-claim it (already claimed)
- `complete()` was never called
- Worker restart won't help—the job is locked

**Consequence:** Manual intervention required to unstick jobs. Affects throughput and SLA compliance.

**Evidence:** No idempotency; no cleanup for partial failures. `worker.js:7-8` has no transaction semantics.

---

### 3. No Retry or Dead Letter Handling

**Severity: MEDIUM**

If `notifyPartner()` fails (network, timeout, partner error):
- Exception thrown → worker crashes
- Process manager restarts worker
- Worker tries to claim next job, skipping the failed one
- Failed job is now claimed forever (issue #2 above)

**Consequence:** Work is silently lost. Partner is not notified for some invoices.

**Evidence:** `worker.js:7` can throw; no catch/retry. `notify.js:10` throws on non-2xx but doesn't distinguish retryable from fatal errors.

---

### 4. Insufficient Test Coverage

**Severity: MEDIUM**

Current test covers only:
- ✓ Single worker, happy path
- ✗ Concurrent workers claiming same job
- ✗ Notification failure recovery
- ✗ Partial failure between notify and complete
- ✗ File corruption or I/O errors

**Consequence:** Issues #1–3 are not caught by CI. Scaling introduces production incidents.

---

### 5. Missing Input Validation and Security

**Severity: MEDIUM**

- `PARTNER_WEBHOOK` env var not validated (empty, malformed, or unsafe)
- No timeout on `fetch()` to partner endpoint (can hang indefinitely)
- Job object not validated (any properties accepted into queue)
- No authentication to partner webhook

**Consequence:** Denial of service, data corruption, or unauthorized job submission.

---

### 6. File-Based State, No Versioning

**Severity: LOW**

- Job schema has no version field; schema changes require manual migration
- No incremental sync or backup; full file rewrite on every operation (inefficient and risky)
- Concurrent writes without atomic flush can corrupt .data/jobs.json

**Consequence:** Cannot safely deploy schema changes. At scale, file thrashing causes I/O bottleneck and potential data loss.

---

## What Would Break at Scale (8+ workers)

1. **Job duplication:** Multiple workers processing same invoice → billing anomalies
2. **Deadlocked jobs:** Failed notifications → stuck claimed jobs → manual remediation required
3. **Lost work:** Unhandled exceptions → invoices not sent to partner
4. **File corruption:** Concurrent writes to small JSON file → unpredictable state

---

## Engineering Policy Gaps

| Policy | Status | Issue |
|--------|--------|-------|
| Clarify material unknowns before architecture | ❌ | Concurrency model unspecified; file-based queue not discussed with partner |
| Validate inputs at trust boundaries | ❌ | No env var validation, no job schema validation, no webhook auth |
| Add focused tests for critical behavior and failure paths | ❌ | Happy path only; no concurrency, failure, or recovery tests |
| Run product, tests, build before completion | ⚠️ | Tests pass but don't exercise failure paths; no manual testing of retry behavior |
| Prefer smallest coherent implementation | ✓ | Code is minimal but lacks essential safeguards for distributed operation |

---

## Required Before Scaling

To safely increase worker count to 8+:

1. **Atomic job claiming:** Implement file locking (or switch to a proper queue like Redis/SQS) to prevent race conditions
2. **Idempotent notifications:** Track which jobs have been notified; retry with exponential backoff; log all attempts
3. **Dead letter queue:** Jobs that fail consistently must be movable to a separate queue for investigation
4. **Comprehensive failure tests:** Concurrent access, partial failures, network errors, process crashes
5. **Input validation:** Env vars, job schema, timeouts, webhook authentication
6. **Observability:** Structured logging of claim, notify, complete events with timestamps and error details

---

## Verified

- ✓ Code compiles and existing test passes
- ✓ Basic enqueue/claim/complete flow works for single worker
- ✓ Environment variable pattern for partner webhook is in place
- ✗ Multiple workers can safely share the job queue
- ✗ Failed notifications are recoverable
- ✗ Partial failures are handled atomically
