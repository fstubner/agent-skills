# Quick Start for On-Call Operations

## Start the Server
```bash
npm install
npm start
```
Server listens on port 3000 (or `$PORT` environment variable).

## Test Basic Health
```bash
# Should return HTTP 200 with healthy status
curl http://localhost:3000/health
```

## Assign a Job (Test the API)
```bash
curl -X POST http://localhost:3000/jobs/123/assign \
  -H "Content-Type: application/json" \
  -d '{"region": "west"}'
```

## Check Logs for Request Tracing
When the API processes a request, each log line includes a request ID:
```
[a1b2c3d4e5f6] assigning job 123 to region west
[a1b2c3d4e5f6] successfully assigned to driver driver-42
[a1b2c3d4e5f6] POST /jobs/123/assign 200 250ms
```

## Kubernetes Probe Configuration

### Liveness Probe
Detects if pod is hung/unresponsive:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Readiness Probe
Detects if pod is shutting down or unhealthy:
```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 5
  failureThreshold: 2
```

## Interpreting /health Response

**Healthy** (HTTP 200):
- Pod is accepting requests
- No stuck requests
- Ready to serve traffic

**Unhealthy** (HTTP 503):
- One or more requests have been stuck for >30 seconds
- Check `stuckRequestIds` field
- Correlate request IDs with logs to understand what's stuck
- Consider isolating pod from load balancer

## Correlating User Issues with Logs

User says: "Job 123 couldn't be assigned"

Steps:
1. Ask for request ID from error response (e.g., `a1b2c3d4e5f6`)
2. Search logs for `[a1b2c3d4e5f6]`
3. See: When job was requested, how long it took, what error was returned

Example log sequence for a failed request:
```
[a1b2c3d4e5f6] assigning job 123 to region west
[a1b2c3d4e5f6] assignment failed: No available drivers in region west
[a1b2c3d4e5f6] POST /jobs/123/assign 503 30001ms
```

Interpretation: Waited 30 seconds, no drivers available in region west.

## Common Responses

| Status | Meaning | Action |
|--------|---------|--------|
| 200 `{"driver": "driver-42"}` | Success | Job assigned |
| 400 `{"error": "Missing region..."}` | Client error | Client must send `region` in body |
| 503 `{"error": "No available drivers..."}` | No drivers available | Check driver availability |
| 503 `{"error": "Server is shutting down"}` | Pod shutting down | Retry on different pod |
| 500 `{"error": "..."}` | Unexpected error | Check server logs |

## Monitoring Dashboard Setup

Query your logs for:
- Request count: `[.*] POST /jobs/`
- Error rate: `503 No available drivers`
- Slow requests: `[.*] POST /jobs/.*[3-9]\d\d\d\d\d ms` (>30s)
- Stuck requests: `/health.*stuckCount` (grep for non-zero)

## Testing Failure Modes

### Test Timeout Behavior
1. Stop all driver services (simulate regional outage)
2. Try assignment: `curl -X POST http://localhost:3000/jobs/1/assign -H "Content-Type: application/json" -d '{"region":"west"}'`
3. Wait 30 seconds → should get HTTP 503 "No available drivers"

### Test Graceful Shutdown
1. Start server
2. Send SIGTERM: `kill -TERM <pid>`
3. Check logs for: `SIGTERM received`, then `all requests drained` or `force exit after 30s grace period`

### Test Health Check
1. Start server
2. Immediately: `curl http://localhost:3000/health` → should be healthy
3. During slow request: Health check still responds immediately (uses separate goroutine)
4. If request hangs >30s: Health check returns 503 with stuck request IDs

## When Things Go Wrong

1. **Pod constantly unhealthy**: Check `/health` returns `stuckRequestIds` → isolate pod
2. **Users report "no drivers" errors**: Confirmed - checking driver dashboard will show the cause
3. **Requests taking 30+ seconds**: Timeout expired waiting for drivers, this is expected behavior
4. **Pod not responding**: Send SIGTERM, wait 30 seconds, then force kill if needed
5. **Can't find request in logs**: Verify request ID format (16 hex chars like `a1b2c3d4e5f6789`)

## Escalation Path

If you can't resolve an issue:
1. Capture `/health` response
2. Extract any `stuckRequestIds` from health check or error responses
3. Search logs for those request IDs
4. Share these logs with the development team
5. Include: error message, request ID, region, timestamp

With this information, the dev team can immediately understand what went wrong.
