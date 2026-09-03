# Dispatch API Operations Guide

## Signals

The dispatch API emits structured JSON logs to stdout. Each log record includes:
- `timestamp`: ISO 8601 timestamp
- `level`: log severity (info, error)
- `correlationId`: UUID that traces the request through the entire system
- `message`: log event type
- Additional context fields specific to the event

### Key signals to monitor:

**Healthy operation:**
- `assign_request_received`: Job assignment request arrived (info level)
- `assign_success`: Job successfully assigned to a driver (info level)
- `health_check`: Health endpoint responding (info level, status: healthy)

**Problem indicators:**
- `assign_failed` with `errorType: timeout`: No drivers available in the requested region (error level)
- `assign_failed` with `errorType: error`: Unexpected error during assignment (error level)
- `health_check` with `status: degraded`: All drivers are busy (info level)
- `health_check` with `status: degraded` for extended period: Indicates persistent capacity issue

### How to trace a request:

1. Get the correlation ID from the response header `x-correlation-id` or the error response's `correlationId` field
2. Search logs for that correlation ID to see all operations related to that request:
   ```
   grep '"correlationId":"<uuid>"' application.log
   ```

### Consuming the health endpoint:

- `GET /health`: Returns current health status with driver counts
  - Status 200: Healthy (free drivers available)
  - Status 503: Degraded (no free drivers)
  - Response includes: total drivers, busy count, free count
  
- `GET /ready`: Readiness probe for orchestration systems
  - Status 200: Server is ready to accept traffic
  - Always returns true if the server is running

## Alerts

Configure these alerts in your monitoring system:

| Alert | Condition | Threshold | First Response |
|-------|-----------|-----------|-----------------|
| AssignmentTimeout | Error rate of `errorType: timeout` in logs | > 10% of requests over 5 min | Check /health endpoint - if status is degraded, scale driver pool. If /health is healthy, check region-specific driver availability. |
| AssignmentError | Error rate of `errorType: error` in logs | > 1% of requests over 5 min | Check logs for `assign_failed` errors. Most likely cause: bugs in driver state management. Escalate to engineering. |
| HealthCheckDegraded | /health returns status: degraded | Sustained for > 5 min | Indicates all available drivers are busy. Scale the driver pool or investigate if jobs are not releasing drivers properly. |
| ServerNotReady | /ready returns status: not ready | Sustained for > 1 min | Server is starting up or in a bad state. Check if process is running: `ps aux \| grep 'node src/server.js'`. If running, restart the service. |
| HighLatency | p99 latency on /jobs/\*/assign | > 10 seconds | Usually indicates assign_timeout approaching. Check available drivers with /health. If all busy, scale or investigate why jobs aren't completing. |

## Failure Modes

### 1. All drivers are busy (most common in production)
**Symptom:** `assign_failed` errors with `errorType: timeout`, /health returns `status: degraded`
**Root cause:** Driver pool is undersized for current job volume, or jobs are not releasing drivers after completion.
**Detection:** Check free driver count in /health response. If consistently 0, this is the issue.
**Immediate action:** 
- Check if jobs are completing normally (check job completion logs)
- If jobs are stuck, restart the service to reset driver state
- If jobs are normal, add more drivers to the pool via configuration

### 2. Service hangs indefinitely on request (timeout disabled or misconfigured)
**Symptom:** Requests never return, server appears stuck
**Root cause:** ASSIGN_TIMEOUT_MS environment variable not set or set to 0
**Detection:** Monitor /health endpoint - if it stops responding, server is hung
**Immediate action:** Restart the service and ensure ASSIGN_TIMEOUT_MS is set to a reasonable value (default 30s)

### 3. No drivers in specific region
**Symptom:** `assign_failed` with `errorType: timeout`, but /health shows free drivers exist
**Root cause:** Free drivers don't exist in the requested region
**Detection:** Inspect assign_failed error logs - check if region exists and has drivers
**Immediate action:** Redistribute drivers across regions or add more drivers to underserved regions

### 4. Memory leak in driver state
**Symptom:** Memory usage grows over time, eventually server becomes unresponsive
**Root cause:** Drivers are marked busy but never marked free
**Detection:** Monitor memory usage; check if driver count increases over time via /health
**Immediate action:** Restart the service. Contact engineering to investigate driver release mechanism.

### 5. Corrupted driver state
**Symptom:** `assign_failed` errors but /health reports free drivers available
**Root cause:** Driver state is internally inconsistent
**Detection:** /health and actual request behavior don't match
**Immediate action:** Restart the service to reset driver state

## Recovery

### Normal restart (preferred)
```bash
# 1. Stop the service gracefully (allow in-flight requests to complete)
kill -TERM $(pgrep -f 'node src/server.js')

# 2. Wait for graceful shutdown (max 30 seconds)
sleep 5

# 3. Verify process stopped
ps aux | grep 'node src/server.js' | grep -v grep

# 4. Start the service
PORT=3000 ASSIGN_TIMEOUT_MS=30000 npm start

# 5. Verify it's ready
curl http://localhost:3000/ready

# 6. Check health
curl http://localhost:3000/health
```

### Rollback procedure
If the current version has critical bugs:
```bash
# 1. Get the previous git tag/commit
git describe --tags --abbrev=0

# 2. Checkout the previous version
git checkout <previous-tag>

# 3. Install dependencies
npm install

# 4. Restart using the previous version (same steps as Normal restart above)
```

### Data at risk
- **Driver pool state (DRIVERS map):** In-memory only, not persisted. Lost on restart.
  - Impact: Jobs in assignment will timeout, requiring retry
  - Mitigation: Driver pool should be externalized to persistent store before scaling to multi-instance deployment
- **In-flight requests:** Will timeout during restart if graceful shutdown exceeds timeout window
  - Impact: Clients will receive timeout errors and should retry
  - Mitigation: Ensure requests can be safely retried (idempotent)

### Pre-production checklist before scaling to multi-instance
- [ ] Driver pool moved from in-memory Map to persistent data store
- [ ] Job assignment tracking moved to persistent store
- [ ] Request correlation IDs are logged and indexed in centralized logging system
- [ ] Alerts are wired to PagerDuty or equivalent
- [ ] Post-incident runbook created and tested
- [ ] Load testing completed with expected traffic volume
- [ ] Rollback has been tested end-to-end

### Known gaps (to be filled as experience grows)
- No empirical data yet on what driver count is needed per region under real traffic
- No known failure scenarios under traffic spikes (needs load testing)
- Graceful shutdown not implemented yet (processes killed abruptly today)
- No dead letter queue for failed assignments (customers should retry)
