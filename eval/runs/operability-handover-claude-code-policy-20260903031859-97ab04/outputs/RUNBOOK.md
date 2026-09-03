# Dispatch API Runbook

## Overview
The dispatch API assigns jobs to available drivers by region. It serves POST `/jobs/:id/assign` requests and provides health check endpoints for monitoring.

## Health Checks

### Liveness Check: `GET /health/live`
- **Purpose**: Verify the server process is running
- **Expected response**: `{"status": "alive"}` (200 OK)
- **Use in**: Kubernetes liveness probes, load balancer health checks
- **Action if failing**: Restart the pod/instance

### Readiness Check: `GET /health/ready`
- **Purpose**: Verify the API is ready to handle assignment requests
- **Expected response**: 
  ```json
  {
    "ready": true,
    "driverCount": 42,
    "busyCount": 15,
    "freeCount": 27
  }
  ```
  Status 200 if ready, 503 if not ready
- **Use in**: Kubernetes readiness probes, traffic routing decisions
- **Action if ready=false**: Check driver availability (see "No drivers available" below)

## Common Issues and Resolution

### Issue: `GET /health/ready` returns 503 with "no drivers available"
**Symptoms**: Readiness probe fails, traffic drained from this instance
**Likely causes**:
- All drivers in region are busy (normal under high load)
- Drivers crashed or disconnected (check driver service)
- Driver configuration not loaded (check deployment)

**Resolution**:
1. Check driver service status in that region
2. Verify driver count isn't stuck at 0 (indicates init problem)
3. If transient: wait for busy drivers to free up
4. If persistent: restart the instance or drain traffic

### Issue: `POST /jobs/:id/assign` returns 503 "no available drivers (timeout)"
**Symptoms**: Assignment requests timing out after 30 seconds
**Likely causes**:
- All drivers in requested region are busy
- Regional outage (drivers not reporting availability)
- High request volume exceeds driver capacity

**Resolution**:
1. Check readiness endpoint: `curl http://localhost:3000/health/ready`
2. If freeCount > 0 but requests still timeout, drivers may be stuck busy (bug)
3. If freeCount = 0, scale drivers up or defer non-critical jobs
4. If freeCount looks wrong vs actual traffic, restart drivers in that region

### Issue: `POST /jobs/:id/assign` returns 400 "region is required"
**Symptoms**: Client errors on assignment requests
**Cause**: Request body missing `region` field
**Resolution**: Client must send `{"region": "us-west"}` in request body

### Issue: `POST /jobs/:id/assign` returns 500 "could not assign"
**Symptoms**: Requests fail with generic error
**Action**: 
1. Check request ID in response header (`X-Request-ID`)
2. Search logs for that request ID
3. Look for error messages with that request ID to see root cause
4. Common causes: driver state corruption (restart), race condition (file issue)

## Monitoring

### Key Metrics to Alert On

1. **Response Time**: `POST /jobs/:id/assign` p99 > 25s (approaching 30s timeout)
   - Action: Scale drivers or reduce traffic

2. **Error Rate**: 5xx responses > 1%
   - Check logs for patterns
   - Look at status codes: 503 (capacity) vs 500 (bugs)

3. **Readiness**: `/health/ready` returns 503 for > 2 minutes
   - Indicates driver capacity problem
   - May warrant scaling or incident

4. **Timeout Rate**: 503 "no available drivers (timeout)" > 10%
   - Drivers are fully booked
   - Need to scale drivers or shed load

### Log Format
Logs are JSON with fields:
- `timestamp`: ISO 8601 timestamp
- `level`: debug, info, warn, error
- `message`: Human-readable message
- `requestId`: Unique ID for request tracing (included in X-Request-ID response header)
- `durationMs`: Time spent in request handler
- Additional context fields (jobId, region, driver, etc.)

**Example**:
```json
{"timestamp":"2025-09-03T12:34:56.789Z","level":"info","message":"assign success","requestId":"550e8400-e29b-41d4-a716-446655440000","durationMs":42,"jobId":"job-123","region":"us-west","driver":"driver-7"}
```

### Tracing a Request
When a user reports an issue:
1. Get the timestamp and region from the user
2. Search logs for your region in that timeframe
3. Look for request IDs with matching jobs
4. Use request ID (`requestId` field) to trace through all related logs

Example grep:
```bash
grep '"requestId":"550e8400"' app.log
```

## Deployment

### Environment Variables
- `PORT`: Server port (default: 3000)

### Startup
```bash
npm start
```

Server logs startup success with port.

### Shutdown
- Graceful shutdown: finish in-flight requests then exit
- Hard kill (SIGTERM): server exits immediately

## Dependencies
- Node.js (built-in modules only: crypto, events)
- Express 4.19.0

## Contacts
When unsure: check recent deployment diff, check driver service health, check regional infrastructure status.
