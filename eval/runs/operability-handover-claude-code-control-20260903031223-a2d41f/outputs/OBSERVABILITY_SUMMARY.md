# Production Readiness: Observability Enhancements

## Overview
The dispatch API is now production-ready with comprehensive observability for the on-call team to operate, diagnose, and fix issues without access to the developers who built it.

## Changes Made

### 1. Health Check Endpoint (`GET /health`)
- Returns HTTP 200 with `{ status: "healthy", activeRequests, uptime }` when all systems operational
- Returns HTTP 503 when requests have been stuck for >30 seconds
- Includes list of stuck request IDs for correlation with logs
- **For ops**: Use this for liveness/readiness probes in Kubernetes

### 2. Request Tracing with Correlation IDs
- Every request gets a unique 16-character hex ID (e.g., `a1b2c3d4e5f6789`)
- ID is included in:
  - All console logs for that request (`[id] message`)
  - Error response JSON (`"requestId": "a1b2c3d4e5f6789"`)
- **For ops**: When a user complains about a request, use the request ID to trace the entire lifecycle in logs

### 3. Structured Logging
- Request entry: `assigning job {id} to region {region}`
- Request exit with timing: `POST /jobs/{id}/assign 200 250ms`
- Assignment success: `successfully assigned to driver {driver}`
- Assignment failure with reason: `assignment failed: {error}`
- **For ops**: Parse logs by request ID to understand what happened and how long it took

### 4. Timeout Protection (30-second default)
**Before**: Assignment requests would hang indefinitely if no drivers available in a region
**After**: After 30 seconds of waiting, request returns HTTP 503 with "No available drivers in region {region}"
- **For ops**: Requests won't mysteriously hang; pod health remains observable
- **API contract preserved**: Still assigns to drivers the same way; just adds safety valve

### 5. Meaningful Error Codes
- **HTTP 400**: Client error - missing required `region` field in request body
- **HTTP 503**: Service unavailable - no drivers available OR server shutting down
- **HTTP 500**: Internal error - unexpected system failure
- All errors include `requestId` for correlation
- **For ops**: Can distinguish between "our problem" (503 with timeout) vs "client's problem" (400)

### 6. Graceful Shutdown
When pod receives `SIGTERM` (during rolling update):
1. Immediately stops accepting new requests (returns 503)
2. Drains existing requests (waits up to 30 seconds)
3. Exits cleanly
- Logs show: `SIGTERM received`, `requests drained`, or `force exit after 30s grace period`
- **For ops**: Rolling updates won't drop in-flight requests or cause hung pod

### 7. Active Request Tracking
- Server maintains map of active requests with:
  - Request ID
  - HTTP method and path
  - Start time
- Used by `/health` endpoint to detect stuck requests
- **For ops**: Can correlate health check warnings with request IDs in logs

## Operational Capabilities Enabled

### Tell if Healthy ✅
- `GET /health` returns immediate status
- Includes active request count and uptime
- Alerts on stuck requests automatically

### Know What to Do When Unhealthy ✅
- Runbook in OPERATIONS.md covers three main failure scenarios:
  1. Requests timing out (no drivers available) → Check driver availability
  2. Requests stuck (>30s) → Isolate and kill pod
  3. High latency → Investigate driver state
- Each scenario has clear action items

### Trace Requests ✅
- Unique request ID in all logs and error responses
- Includes HTTP method, path, status code, duration
- Shows exact error message when assignment fails
- Example: "User says job 12345 failed" → grep logs for their request ID → see exactly what happened

## Deployment Impact

### Zero Breaking Changes
- Request/response format unchanged
- Existing tests pass (test/assign.test.js)
- API behavior preserved (still assigns jobs same way)
- Only adds safety timeout and observability

### Before Production
Verify:
1. Tests pass: `npm test`
2. Health endpoint works: `curl http://localhost:3000/health`
3. Request tracing works: `curl -X POST http://localhost:3000/jobs/1/assign -H "Content-Type: application/json" -d '{"region":"west"}'` → check logs for request ID
4. Timeout works: Stop drivers, wait 30s on assignment request → should get 503 "No available drivers"
5. Graceful shutdown works: Start server, send SIGTERM → should see "all requests drained" in logs

## Summary for On-Call Team

The API now provides:
1. **Health visibility**: `/health` endpoint you can poll
2. **Request tracing**: Every request has an ID to track it through logs
3. **Clear error codes**: Know if it's a client error, infrastructure problem, or service unavailable
4. **Timeout protection**: Requests won't hang forever
5. **Safe deployments**: Graceful shutdown ensures no dropped requests
6. **Runbook**: OPERATIONS.md with troubleshooting steps for common issues

You can now operate this API without access to the original development team.
