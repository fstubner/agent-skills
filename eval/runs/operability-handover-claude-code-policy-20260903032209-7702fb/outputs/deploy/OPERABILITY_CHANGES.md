# Dispatch API - Operability Changes

## Summary

Made the dispatch API production-ready by adding health checks, request tracing, and proper timeout handling. Zero breaking changes to API behavior.

## Changes Made

### 1. Health Checks (Critical for K8s rolling updates)

**New endpoints:**
- `GET /health` - Returns driver count and service status (always 200 if running)
  - Use for monitoring dashboards and alerting
  - Response: `{ status: "ok", timestamp: "...", drivers: <count> }`

- `GET /ready` - Readiness probe for Kubernetes
  - Returns 503 if no drivers registered (won't accept traffic)
  - Returns 200 when ready
  - Use in `readinessProbe` in Kubernetes deployment config

**Why this matters:** Without health checks, the load balancer can't detect unhealthy replicas, and rolling updates will hang.

### 2. Request Tracing

**Implementation:**
- All requests get a correlation ID (UUID generated if not provided via `X-Correlation-ID` header)
- Correlation ID returned in response header `X-Correlation-ID`
- Every structured log event includes the correlation ID

**Why this matters:** When someone reports an issue, the on-call engineer can now trace that specific request through all replicas and external systems using the correlation ID.

### 3. Structured Logging (JSON format)

**Changed from:** Simple console.log statements
**Changed to:** JSON structured logs with fields:
- `level`: "info", "warn", "error"
- `correlationId`: Request tracking ID
- `event`: Event type (assign_request, assign_success, assign_failed, invalid_region)
- `jobId`, `region`, `driverId`: Request details
- `error`, `errorCode`: Failure details
- `timestamp`: ISO 8601 timestamp

**Why this matters:** Production log aggregation systems (Datadog, CloudWatch, etc.) parse JSON; simple logs get lost in noise.

### 4. Timeout on Assignment (Fixes infinite loop)

**Changed from:** Infinite retry loop (hangs forever during outages)
**Changed to:** 5-second timeout with clear error code

**Code changes:**
- `assign()` now accepts `timeoutMs` parameter (default 5000)
- Throws error with `code: 'NO_DRIVERS_AVAILABLE'` if timeout exceeded
- Server responds with 503 (Service Unavailable) status code for timeout errors

**Why this matters:** Prevents cascading failures. During regional driver outages, requests fail fast (503) instead of hanging indefinitely, allowing clients to retry elsewhere.

### 5. Input Validation

**Added:** Validation of `region` parameter
- Returns 400 Bad Request if region is missing or not a string
- Logs validation failures for debugging

**Why this matters:** Catches malformed requests before they hang, and provides clear error messages.

## What Didn't Change

- API endpoint paths and methods remain identical
- Request/response JSON structure unchanged (except health endpoints)
- Driver assignment logic unchanged
- Authentication/authorization behavior unchanged (none - add if needed later)

## Testing

Added unit tests for the new timeout behavior:
- `test('assign times out when no drivers available')` - verifies timeout works
- `test('assign returns driver when available')` - verifies normal flow still works

## Deployment Considerations

### Kubernetes Configuration Changes Needed

Add these probes to the dispatch deployment:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Backwards Compatibility

- Existing clients don't need changes (correlation ID is optional via header)
- Health endpoints are new, so no existing clients rely on them
- Timeout behavior: Previously hung forever, now times out (improvement, not breaking change)

## Operations Documentation

Full runbook in `deploy/RUNBOOK.md` covers:
- How to monitor the API
- Common failure scenarios and resolutions
- Manual testing procedures
- Troubleshooting with correlation IDs
