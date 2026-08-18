# Payments Worker Audit

**Status:** NOT READY TO SCALE - Critical issues present

## Highest-Value Findings

### 1. Infinite retry loop on non-200 responses (CRITICAL)
**Location:** `app/worker.py:9-20`

The `charge()` function uses `while True` with no upper bound and only retries if status code is not 200. Any non-200 response (4xx client errors, 5xx server errors) will cause infinite retries at 50ms intervals with no escape condition. This will:
- Hang worker threads indefinitely on payment processor client errors (e.g., 400 Bad Request, 401 Unauthorized, 404)
- Deplete thread pools under load
- Cause cascading failures when scaled to multiple replicas

**Impact:** Deadlock risk in production. Forward-fix only deployment model makes this especially dangerous.

---

### 2. Bare except clause silently swallows all exceptions (CRITICAL)
**Location:** `app/worker.py:18-19`

```python
except Exception:
    pass
```

This catches ALL exceptions (including network timeouts, JSON decode errors, KeyboardInterrupt) and silently continues. Critical issues:
- No logging or monitoring visibility into failures
- Impossible to debug production issues
- Hides real errors (e.g., malformed response, authentication failure)
- Payment amounts and order data could be lost without any alert

**Impact:** Operational blindness. Cannot diagnose failures in production.

---

### 3. No timeout on network requests (HIGH)
**Location:** `app/worker.py:11-15`

`requests.post()` has no timeout parameter. If the processor network hangs or becomes unreachable:
- Threads will block indefinitely waiting for response
- Combined with infinite retry loop, entire worker pool becomes unresponsive
- No graceful degradation

**Impact:** Complete worker unavailability on network issues.

---

### 4. Authentication key not used (HIGH)
**Location:** `app/settings.py:4` and `app/worker.py:11-15`

`PROCESSOR_KEY` is loaded from environment but never passed to the processor endpoint. The charge request is unauthenticated, allowing:
- Anyone with network access to the worker to trigger charges
- Processor cannot validate origin of requests
- No protection against request forgery

**Impact:** Security vulnerability. Should include API key in request headers.

---

### 5. Status code check too strict (MEDIUM)
**Location:** `app/worker.py:16`

Only accepts status code 200 as success. Standard HTTP conventions allow 2xx range for success:
- 201 Created
- 202 Accepted
- 204 No Content

A processor returning 201 would be treated as failure and retried forever, even though the charge succeeded.

**Impact:** Unnecessary retries and duplicate charge risk with compatible processors. Reduces reliability.

---

## Verified

- Worker code structure and retry mechanism
- Configuration loading and environment variable handling
- HTTP request implementation
- Exception handling patterns
- Authentication implementation status
