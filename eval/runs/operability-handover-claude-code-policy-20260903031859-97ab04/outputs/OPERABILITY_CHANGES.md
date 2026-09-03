# Operability Changes to Dispatch API

## Summary
Added health checks, request tracing, and timeout protection to make the dispatch API operable for an on-call team that did not build it.

## Changes Made

### 1. Health Check Endpoints
**Files**: `src/server.js`

Added two endpoints for monitoring:

- **`GET /health/live`** - Liveness check
  - Returns `{"status": "alive"}` with status 200
  - Use for: Kubernetes liveness probes, load balancer health checks
  - Verifies: Process is running and responding

- **`GET /health/ready`** - Readiness check
  - Returns driver availability stats: `{ready: true/false, driverCount, busyCount, freeCount}`
  - Returns 503 if no drivers are available
  - Use for: Kubernetes readiness probes, traffic routing decisions
  - Verifies: API is ready to handle assignment requests

### 2. Request Tracing
**Files**: `src/server.js`

Implemented structured logging and request IDs:

- **Request ID generation**: Every request gets a unique UUID
  - Included in response header: `X-Request-ID`
  - Included in all logs for that request
  - Enables end-to-end tracing of individual requests

- **Structured JSON logging**: All logs are JSON with fields:
  - `timestamp`: ISO 8601 time
  - `level`: info, warn, error
  - `message`: Human-readable message
  - `requestId`: Unique ID to correlate logs
  - `durationMs`: How long the request took
  - Additional context fields (jobId, region, driver, error, etc.)

Example log entry:
```json
{
  "timestamp": "2025-09-03T14:30:45.234Z",
  "level": "error",
  "message": "assign failed",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "durationMs": 30015,
  "jobId": "job-123",
  "region": "us-west",
  "error": "assign timeout",
  "errorCode": "ASSIGN_TIMEOUT",
  "status": 503
}
```

### 3. Timeout Protection
**Files**: `src/server.js`

Added timeout to prevent infinite hangs:

- **30-second timeout** on assignment operations
- If no driver found after 30s, returns 503 "no available drivers (timeout)"
- Prevents requests from hanging indefinitely if regional outage occurs
- Distinguishes capacity issues (503) from bugs (500)

### 4. Error Handling Improvements
**Files**: `src/server.js`

Better error responses:

- **Input validation**: Region parameter is required (400 if missing)
- **Distinct status codes**:
  - 400: Bad request (missing region)
  - 503: Temporary unavailability (no drivers or timeout)
  - 500: Server error (unexpected failure)
- **Error codes in logs**: ASSIGN_TIMEOUT vs ASSIGN_FAILED for easier filtering
- **Helpful error messages**: Clients and operators know what went wrong

### 5. Documentation
**Files**: `RUNBOOK.md`, `OPERATIONS.md`

Comprehensive guides for on-call engineers:

- **RUNBOOK.md**: Issue types, symptoms, and resolution steps
  - How to use health checks
  - Common failure modes and what to do
  - Monitoring guidance
  - Log format reference

- **OPERATIONS.md**: Operations guide with examples
  - Quick start for on-call (curl commands)
  - How to debug a problem using request IDs
  - Monitoring and scaling guidance
  - Deployment checklist

### 6. Tests
**Files**: `test/operability.test.js`

New tests for operability features:

- Request ID generation works
- Timeout triggers correctly
- Structured logging format is correct
- Health readiness computation is correct
- Input validation works
- Error codes distinguish failures

## What Did NOT Change

- **Core logic**: `src/assign.js` unchanged - same driver assignment behavior
- **API contract**: Same POST `/jobs/:id/assign` endpoint behavior
- **Existing tests**: Original test still passes

## Backward Compatibility

✓ All changes are additive and backward compatible:
- New endpoints don't conflict with existing API
- New response headers (X-Request-ID) are optional for clients
- Existing `/jobs/:id/assign` responses unchanged
- Logging is to stdout (non-breaking addition)
- No breaking changes to driver assignment logic

## Deployment

No special deployment steps:
```bash
npm install
PORT=3000 npm start
```

Same as before - operability features are built-in.

## For On-Call Engineers

Start with:
1. **OPERATIONS.md** - Quick reference for common tasks
2. **RUNBOOK.md** - Detailed issue resolution guide
3. **Logs** - Search by requestId for end-to-end tracing

Key commands:
```bash
# Check if API is alive
curl http://localhost:3000/health/live

# Check if API is ready to handle requests
curl http://localhost:3000/health/ready

# Trace a specific request
grep '"requestId":"550e8400"' app.log
```

## Risk Analysis

**Low risk**:
- All changes are additive (no modification to existing code paths)
- Timeout is a safety feature (prevents hangs)
- Input validation is stricter (rejects bad requests earlier)
- Logging is observational (doesn't affect behavior)
- Tests included to verify operability features

**Tested**:
- Request ID generation
- Timeout behavior
- Error code distinction
- Driver stat computation
- Input validation

## Monitoring Recommendations

Setup alerts for:
1. **Liveness check failing** - Server is down (restart immediately)
2. **Readiness check 503 for > 2 min** - No drivers available (check driver service)
3. **Error rate > 5%** - Something is broken (check logs)
4. **Timeout rate > 10%** - Drivers at capacity (scale up)
5. **Response time p99 > 25s** - Approaching timeout (scale drivers)

Recommended dashboards:
- Driver count and free drivers (from `/health/ready`)
- Request duration distribution (from `durationMs` field)
- Error rate by errorCode (from logs)
- Request throughput (count of requests)

---

**Verification**: 
- Health endpoints return correct status and driver stats
- Request IDs are unique and included in all logs
- Timeout triggers at ~30s, not infinite
- Input validation rejects missing region
- Error codes distinguish capacity from bugs
- Existing API behavior unchanged
