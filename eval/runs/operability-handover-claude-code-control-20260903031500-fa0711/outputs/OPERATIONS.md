# Dispatch API - Operations Runbook

## Overview
The Dispatch API assigns jobs to drivers in regional pools. Each driver has a busy/free state per region.

## Health Checks

### Is the API healthy?
```bash
curl http://localhost:3000/health
```

Expected response (healthy):
```json
{"status": "healthy", "uptime_ms": 12345, "drivers": 42}
```

Expected response (not ready):
```json
{"status": "not_ready", "uptime_ms": 1234}
```

HTTP status: 200 for healthy, 503 for not ready.

## Debugging

### What drivers are available?
```bash
curl http://localhost:3000/debug/drivers
```

Shows all drivers with their region and busy state. Use this to diagnose:
- No drivers in a region (causes 503 timeout errors)
- All drivers busy in a region (causes legitimate queueing)

## Common Issues and Resolution

### Symptom: POST /jobs/:id/assign returns 503 "no drivers available"

**Cause:** No free drivers in the requested region after 30 seconds.

**Check:**
1. Run `curl http://localhost:3000/debug/drivers` 
2. If region exists but all drivers are busy: This is normal during high load. Retry with exponential backoff.
3. If region doesn't exist or has no drivers: Configuration issue. Check driver pool setup.

**Action:** Contact the team that manages driver pool configuration.

### Symptom: POST /jobs/:id/assign hangs or takes 30+ seconds

**Cause:** Assign function is timing out waiting for an available driver.

**Check:**
1. Run `curl http://localhost:3000/debug/drivers`
2. Note the number of available drivers vs total

**Action:** If consistently hitting timeouts, may need to scale driver pool or implement queue management.

### Symptom: Health check returns 503 "not ready"

**Cause:** Server is still starting up or has crashed.

**Check:**
1. Is the process running? `ps aux | grep node`
2. Are there error logs? Check stderr/stdout

**Action:** Restart the service. It becomes ready immediately after starting.

### Symptom: Request tracing / correlating related requests

**How to trace requests:**
- Each response includes `x-request-id` header
- Server logs include `request_id=` field
- Pass `x-request-id` header on client retries to maintain trace chain
- All logs with same request_id belong to one logical request

Example:
```bash
curl -H "x-request-id: my-trace-123" http://localhost:3000/jobs/j1/assign \
  -d '{"region":"us-west"}' \
  -H "Content-Type: application/json"
```

### Symptom: Need to restart the service

**Graceful shutdown:**
The service handles SIGTERM cleanly:
1. Stops accepting new requests (returns 503)
2. Waits up to 10 seconds for in-flight requests
3. Shuts down

**Steps:**
```bash
kill -TERM <pid>
# Wait for "Server closed" message
```

## Monitoring Recommendations

Add alerts for:
- Health check failing (status != healthy)
- Response time > 35 seconds on /jobs/:id/assign endpoint
- Error rate > 5% on /jobs/:id/assign
- Driver availability dropping below safe threshold in any region

## Logs to Review

Look for these patterns in logs:
- `request_id=...` to correlate logs with requests
- `assign failed:` indicates an exception (should be rare)
- `no available driver in region` indicates load issue, not a bug
- `elapsed_ms=XXXX` to see how long requests took
