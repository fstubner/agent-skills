# Dispatch API Runbook

## Overview
The dispatch API assigns available drivers to jobs in a given region. It runs in-memory with no persistence.

## Health Check
Check service health via:
```bash
curl http://localhost:3000/health
```

**Healthy response (200):**
```json
{
  "status": "healthy",
  "drivers": { "total": 5, "busy": 2 }
}
```

**Degraded response (503):**
```json
{
  "status": "degraded",
  "drivers": { "total": 0, "busy": 0 }
```

## Common Issues

### 1. Assignment Requests Hanging (504 Gateway Timeout)
**Symptom:** Client receives 504 error or request times out after 30 seconds.

**Root Cause:** No available drivers in the requested region.

**Resolution:**
- Check health: `curl http://localhost:3000/health`
- If `drivers.total == 0` or all drivers are busy in that region, you need to:
  - Restart the service (loses all state but needed if drivers are stuck)
  - Or wait for drivers to become free
  - Or check if driver registration is working (out of scope for this API)

### 2. Service Returns 500 (Assign Failed)
**Symptom:** Assignment fails with `error: "assign_failed"`.

**Root Cause:** Unexpected error in assignment logic.

**Resolution:**
- Check logs for the exact error message (correlation ID in `x-trace-id` header)
- Restart service if error persists

### 3. Service Returns 400 (Bad Request)
**Symptom:** Assignment fails with `error: "region required"`.

**Root Cause:** Client did not provide a `region` field in the request body.

**Resolution:**
- Check client request format: `POST /jobs/{id}/assign` with body: `{"region": "us-west"}`

## Request Tracing
All responses include an `x-trace-id` header for correlating logs with requests:
```bash
curl -i http://localhost:3000/health
# Look for: x-trace-id: 1693234567890-abc123def
```

Include this trace ID in any bug reports or escalations.

## Environment Variables
- `PORT`: Server port (default: 3000)
- `ASSIGN_TIMEOUT_MS`: Timeout for assignment in milliseconds (default: 30000)

## Monitoring

Watch logs for JSON-structured entries:
```bash
tail -f logs | jq '.traceId, .msg, .status'
```

Key log fields:
- `timestamp`: ISO 8601 time
- `traceId`: Request correlation ID
- `level`: info / warn / error
- `msg`: Event type (health_check, assign_start, assign_success, assign_failed, etc.)
- `jobId`, `region`, `driverId`: Request-specific data

## In-Memory State Warning
This service stores all driver state in memory. **Restarting clears all state.** On restart:
- All drivers are lost
- All ongoing requests timeout after 30 seconds
- Clients must retry assignment

For production, plan to migrate to persistent storage before scaling beyond a single instance.
