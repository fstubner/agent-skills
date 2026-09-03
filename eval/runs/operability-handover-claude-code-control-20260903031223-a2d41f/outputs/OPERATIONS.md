# Dispatch API Operations Guide

## Monitoring and Health Checks

### Health Endpoint
- **URL**: `GET /health`
- **Healthy Response** (HTTP 200):
  ```json
  {
    "status": "healthy",
    "activeRequests": 5,
    "uptime": 3600.5
  }
  ```
- **Unhealthy Response** (HTTP 503):
  ```json
  {
    "status": "unhealthy",
    "reason": "requests stuck",
    "stuckCount": 2,
    "stuckRequestIds": ["abc123def456", "xyz789abc123"]
  }
  ```

### What to Monitor
- **Liveness**: Configure Kubernetes liveness probe to call `/health` every 10 seconds with 30-second timeout
- **Readiness**: Configure readiness probe similarly; pod will return 503 during graceful shutdown
- **Alert on**: Any `/health` response showing `"stuckCount" > 0` — indicates requests timing out waiting for drivers

## Troubleshooting

### Scenario 1: Requests Timing Out (503 - No Available Drivers)
**Symptoms**: Assignment requests return 503 with "No available drivers in region {region}"

**Cause**: A region has exhausted its available drivers

**Action**:
1. Check driver availability dashboard
2. Verify drivers are registering properly
3. Check for driver service outages in that region
4. If persistent, scale up more drivers or redirect traffic

### Scenario 2: Requests Hanging (Health Check Shows Stuck Requests)
**Symptoms**: `/health` returns 503 with `stuckRequestIds`

**Cause**: Requests stuck for >30 seconds waiting for drivers (should timeout, but something prevented it)

**Action**:
1. Immediately isolate the replica by removing from load balancer
2. Kill the stuck pod (`kubectl delete pod <pod-name>`)
3. Investigate logs from that replica
4. Check driver availability in all regions

### Scenario 3: High Request Latency
**Symptoms**: Assignment requests taking 10-30+ seconds even when drivers are available

**Cause**: No drivers available, request retrying every 100ms

**Action**:
1. Check driver availability
2. Review recent driver registration/deregistration events
3. Look for regional outages

## Request Tracing

Every request gets a unique request ID in logs and error responses.

### Sample Log Output
```
[startup] listening on port 3000
[a1b2c3d4e5f6] assigning job 12345 to region west
[a1b2c3d4e5f6] successfully assigned to driver driver-42
[a1b2c3d4e5f6] POST /jobs/12345/assign 200 250ms
```

### Using Request IDs
- **In logs**: Search for the request ID to trace the entire request lifecycle
- **In errors**: Error responses include `requestId` field — use it to correlate with logs
- **Example**: A user says "my job assignment failed" → they provide request ID → grep logs for that ID to see what happened

## Deployment and Graceful Shutdown

### Rolling Updates
When deploying a new version:
1. Kubernetes sends `SIGTERM` to old pod
2. Pod immediately stops accepting new requests (returns 503)
3. Pod waits up to 30 seconds for in-flight requests to complete
4. Pod exits cleanly

**In logs during shutdown**:
```
[shutdown] SIGTERM received, stopping new requests
[shutdown] all requests drained, exiting
```

**If requests don't drain within 30 seconds**:
```
[shutdown] force exit after 30s grace period (3 requests remaining)
```

### Safe Deployment Procedure
1. Monitor `/health` during rollout
2. If a pod shows stuck requests immediately after deployment, roll back
3. Check logs for pattern: compare new version logs to previous

## API Contract

### Request: Assign a Job
```
POST /jobs/{jobId}/assign
Content-Type: application/json

{
  "region": "west"
}
```

### Successful Response (HTTP 200)
```json
{
  "driver": "driver-123"
}
```

### Error Responses

**Missing Region (HTTP 400)**:
```json
{
  "error": "Missing region in request body"
}
```

**No Drivers Available (HTTP 503)**:
```json
{
  "error": "No available drivers in region west",
  "requestId": "a1b2c3d4e5f6"
}
```

**Server Shutting Down (HTTP 503)**:
```json
{
  "error": "Server is shutting down"
}
```

**Internal Error (HTTP 500)**:
```json
{
  "error": "<error message>",
  "requestId": "a1b2c3d4e5f6"
}
```

## Performance Characteristics

- **Timeout**: Requests wait up to 30 seconds for an available driver
- **Retry interval**: 100ms between driver availability checks
- **Health check sensitivity**: Flags issues if any request exceeds 30 seconds

## Quick Reference

| Issue | Check | Action |
|-------|-------|--------|
| All responses 503 | `/health` → `stuckRequestIds` | Kill replica, investigate logs |
| Responses 503 "No available drivers" | Driver dashboard | Scale drivers or redirect traffic |
| Request latency > 10s | `/health` → healthy but slow | Check driver availability |
| Pod not draining during deployment | Logs | Review request patterns, consider longer grace period |
