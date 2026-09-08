# Payments Worker Audit

**Status:** Not ready to scale. Five critical findings require resolution before production deployment.

---

## Finding 1: Infinite retry loop without backoff bounds (Critical)

**Location:** `app/worker.py:9-20` — `charge()` function

**Issue:** The retry loop `while True` has no maximum attempts, no exponential backoff strategy, and no circuit breaker. It retries every 50ms indefinitely on any failure, including non-transient errors.

**Risk:** 
- Hammers the card processor even during genuine outages (amplifies cascading failure)
- Exhausts worker CPU and memory under load
- Charges may remain in-flight indefinitely with no visibility into eventual outcome
- Violates the stated goal of "safe to scale" — scaling amplifies the problem

**Fix:** Implement exponential backoff with a reasonable maximum (e.g., 5 retries over 1-2 minutes), and distinguish transient (5xx, timeout) from non-transient (4xx, bad request) errors. Return/log permanent failures rather than looping forever.

---

## Finding 2: No input validation at trust boundary (High)

**Location:** `app/worker.py:7-14` — `charge()` function accepts `order` without validation

**Issue:** The function passes `order["id"]`, `order["amount_cents"]`, and `order["card_token"]` to the processor without verifying:
- Required fields exist
- `amount_cents` is a positive integer
- `card_token` matches expected format
- Order structure is valid

**Risk:**
- Malformed orders corrupt processor requests
- Negative or zero amounts slip through
- Invalid tokens cause cryptic processor errors
- No audit trail of what was sent

**Fix:** Validate order schema at entry (e.g., check keys, amount > 0, token format) and raise clear exceptions on failure. Log the validation failure for debugging.

---

## Finding 3: Silent exception swallowing with no error classification (High)

**Location:** `app/worker.py:18-19` — `except Exception: pass`

**Issue:** All exceptions (network timeout, invalid JSON, 4xx processor errors, authentication failures, out-of-memory) are caught and treated identically as "transient, retry forever." No distinction between:
- Transient (network flake, 503 Service Unavailable)
- Permanent (400 Bad Request, authentication failure, invalid card token)
- System issues (timeout, memory error)

**Risk:**
- Invalid card tokens retry indefinitely instead of failing safely
- 401/403 from processor retry forever without alerting
- Timeouts treated like transient glitches, causing cascading delays
- No visibility into why a charge is actually failing

**Fix:** Classify exceptions by type (connection error, timeout, 4xx vs 5xx). Log exceptions with the full traceback. Retry only on transient errors; fail fast on permanent ones.

---

## Finding 4: No authorization or authentication mechanism (High)

**Location:** `app/worker.py:4, 11-15` and `app/settings.py:4`

**Issue:** 
- `PROCESSOR_KEY` is loaded in settings but never used in `charge()`
- Requests to the processor include no authentication header, signature, or token
- No verification that the worker is authorized to process the order
- Processor URL is hardcoded; no way to rotate or update it

**Risk:**
- Any service with network access can call the processor's endpoint
- No audit trail linking charges to this worker
- No way to revoke the worker's access without code change
- Open to man-in-the-middle attacks if HTTPS is not enforced (and there's no verification of it)

**Fix:** Include `PROCESSOR_KEY` in request headers (e.g., `Authorization: Bearer ...`). Verify HTTPS. Add a signature or HMAC if the processor supports it.

---

## Finding 5: No idempotency key — double-charge risk (High)

**Location:** `app/worker.py:11-17` — No idempotency key in request

**Issue:** The README claims the worker is "idempotent and safe to run on several machines at once," but:
- Each request lacks an idempotency key (e.g., derived from order ID)
- If a charge succeeds but the response is lost (network glitch), retry sends a duplicate request
- Multiple replicas processing the same order concurrently have no deduplication
- Processor has no way to recognize and reject duplicate charges

**Risk:**
- Customers charged twice (or more) for a single order
- Financial reconciliation nightmare
- Violates stated idempotency guarantee

**Fix:** Generate or use a stable idempotency key (e.g., `order_id`) and include it in the request. Instruct the processor to return the same result if the same key arrives twice. Implement client-side deduplication for orders.

---

## Additional observations (not in top 5)

- **Tests are inadequate:** Only module import and batch size checks. No tests for `charge()` logic, retries, or error paths despite README promising pytest covers retry logic.
- **Unused settings:** `DATABASE_URL` and `BATCH_SIZE` loaded but never used; suggests incomplete implementation.
- **No logging or observability:** No way to debug failures in production or understand which charges succeeded/failed.
- **Deployment risk:** Forward-fix-only policy with no rollback means a bad deploy cannot be undone. Combined with lack of observability, this is dangerous.

---

## Verified

- Reviewed worker logic, settings, test suite, and deployment documentation
- Confirmed no external dependencies declared (intentional per comments)
- Identified retry and authorization gaps that prevent safe scaling
- No changes made to the application
