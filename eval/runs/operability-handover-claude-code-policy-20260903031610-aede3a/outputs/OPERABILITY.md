# Production Operability Changes

## Summary
Added observability and diagnostics to the dispatch API without changing its core behavior. On-call teams can now:
1. **Monitor health** via `/health` endpoint
2. **Trace requests** using correlation IDs in `x-trace-id` headers
3. **Diagnose failures** via structured JSON logs
4. **Know timeouts** when assignments hang (504 after 30 seconds)

## Changes Made

### 1. Health Check Endpoint (server.js)
**Endpoint:** `GET /health`

**Purpose:** Determine if the service is operational and has available drivers.

**Response:**
- **200 OK** when drivers are available
- **503 Service Unavailable** when no drivers exist (degraded)

**Returns:**
```json
{
  "status": "healthy|degraded",
  "drivers": { "total": N, "busy": M }
}
```

**Usage:**
```bash
curl http://localhost:3000/health
```

### 2. Request Tracing (server.js)
**Feature:** Automatic trace ID generation and propagation.

**How it works:**
- Generates UUID-like trace ID if not provided (`x-trace-id` header)
- All responses include the `x-trace-id` header
- All logs include the trace ID for correlation

**Usage:**
```bash
# First request (generates trace ID)
curl http://localhost:3000/health

# Follow-up requests with same trace ID
curl -H "x-trace-id: abc123" http://localhost:3000/health
```

### 3. Structured JSON Logging (server.js)
**Format:** All console output is JSON-formatted with:
- `timestamp`: ISO 8601 timestamp
- `traceId`: Request correlation ID
- `level`: info / warn / error
- `msg`: Event type
- Additional fields: jobId, region, driverId, status, error, etc.

**Example log lines:**
```json
{"timestamp":"2026-09-03T14:22:10.123Z","traceId":"1693234567890-abc123def","level":"info","msg":"assign_start","jobId":"j1","region":"us-west"}
{"timestamp":"2026-09-03T14:22:10.456Z","traceId":"1693234567890-abc123def","level":"info","msg":"assign_success","jobId":"j1","region":"us-west","driverId":"d1"}
```

**Parsing logs:**
```bash
# Extract specific trace
tail logs | jq 'select(.traceId=="abc123")'

# Count errors by type
tail logs | jq 'select(.level=="error") | .msg' | sort | uniq -c

# Monitor health checks
tail logs | jq 'select(.msg=="health_check")'
```

### 4. Assignment Timeout (server.js)
**Timeout:** 30 seconds (configurable via `ASSIGN_TIMEOUT_MS` env var)

**Behavior:**
- If no driver becomes available within 30 seconds, request fails with 504
- Response body: `{ error: "no_available_driver" }`
- Prevents infinite hangs; on-call knows something is wrong instead of silent failure

**Configuration:**
```bash
# Override timeout to 60 seconds
export ASSIGN_TIMEOUT_MS=60000
npm start
```

### 5. Input Validation (server.js)
**Validation:** Requires `region` field in POST body.

**On missing region:**
- Status code: 400 Bad Request
- Response: `{ error: "region required" }`

### 6. Runbook (RUNBOOK.md)
**Contents:**
- Health check usage
- Common issues (no drivers, timeouts, bad requests)
- Troubleshooting steps
- Request tracing examples
- Environment variable documentation
- In-memory state warning

### 7. Expanded Test Suite (test/assign.test.js)
**New tests:**
- `assign marks driver as busy` - Verifies driver state changes
- `assign respects region filtering` - Ensures region isolation
- `DRIVERS map exists` - Confirms data structure
- `assign function exists` - Sanity check

## What Unchanged
- Core assignment logic (same infinite polling in assign function)
- DRIVERS in-memory storage
- API endpoint paths and request/response structure
- Job assignment behavior (marks driver busy, returns driver ID)

## For On-Call: Key Responses

### "API won't respond"
```bash
curl http://localhost:3000/health
# If no response → server crashed, restart
# If response with total:0 → no drivers, check driver registration
# If response with busy:N → service is running but busy
```

### "Client says job assignment failed"
1. Get the trace ID from client or response header
2. Search logs: `jq 'select(.traceId=="abc123")'`
3. Look for `assign_failed` or `no_available_driver` in logs
4. If `no_available_driver`: no free drivers in that region
5. If `assign_failed`: unexpected error, check full error message in logs

### "Assignment takes too long"
- Wait up to 30 seconds (or configured timeout)
- After 30 seconds: guaranteed 504 response instead of hanging
- Check health endpoint to see driver availability

## Dependencies
- express (unchanged)
- node built-ins only for new features (Promise.race, JSON, Date, setTimeout)

## Performance Impact
- Negligible: trace ID generation is once per request
- Health endpoint is O(N) where N = number of drivers (small)
- Structured logging has minimal overhead

## Monitoring Recommendations
1. Alert on `/health` returning 503
2. Alert on high rate of `no_available_driver` errors
3. Monitor response time on `/jobs/:id/assign` (should be fast for available drivers)
4. Alert if response time consistently hits 30 second timeout
