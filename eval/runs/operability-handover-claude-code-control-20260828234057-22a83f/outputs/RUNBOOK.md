# Dispatch API Runbook

**On-Call Quick Start**: Check health, monitor error rates, look at request traces to diagnose issues.

## Service Overview

The Dispatch API assigns jobs to available drivers by region. It runs as 3 replicas behind a load balancer on production. The API does not persist state—all driver availability is in-memory.

## Health Checks

### Liveness Check
```bash
curl http://localhost:3000/health
```
Returns `{"status":"ok","requestId":"<id>"}` if the replica is alive.

**When to check**: During page-outs or when replica is suspected to be down.

### Expected Response Times
- `/health`: <10ms
- `/jobs/{id}/assign`: <100ms (if drivers available), 10s (if timeout)

If a replica takes longer than 10s to respond to assign requests, the driver pool is exhausted and you may need to scale drivers.

## Common Issues and Diagnosis

### Issue: High 503 Response Rate
**Symptoms**: Requests return 503 "no drivers available"

**Diagnosis**:
1. Check if drivers are actually running: `SELECT COUNT(*) FROM driver_fleet WHERE region = 'REGION'`
2. Check if drivers are marked as busy: Look at in-memory state on a replica
3. Check recent logs for repeated timeout errors with same region

**Resolution**:
1. Scale up driver fleet for the affected region
2. Check driver health—if many are crashing, restart the driver service
3. If a single region is affected, check for regional outages

### Issue: Hanging Requests (After 10s Timeout Fires)
**Symptoms**: Clients see 503 after 10 seconds

**Diagnosis**:
1. Check logs for "No drivers available in region" errors
2. Confirm driver service is running: `ps aux | grep driver`
3. Verify network connectivity between API and driver service

**Resolution**:
1. Restart driver service to reset state
2. Check network connectivity to driver region
3. Verify driver registration is working (should see driver joins in logs)

### Issue: Request Hangs or Returns 500 Error
**Symptoms**: A specific request takes >10s or fails with 500

**Diagnosis**:
1. Look up request by ID in logs: `grep "<request-id>" app.log`
2. Check client sent correct region in `POST /jobs/{id}/assign` body: `{"region":"..."}`
3. Verify driver service connectivity for that region

**Resolution**:
1. If driver service is down, restart it
2. If region is not recognized, check region configuration
3. Retry the request—if it succeeds, was transient

## Request Tracing

Every request gets a unique ID for tracing:

### Finding a Request in Logs
```bash
grep "x-request-id-value" /var/log/dispatch-api.log
```

### Passing Request ID from Client
Clients can provide their own request ID:
```bash
curl -H "x-request-id: my-tracking-id" \
  -X POST http://localhost:3000/jobs/job123/assign \
  -d '{"region":"us-west"}'
```

Response includes the request ID:
```json
{"driver":"driver456"}
```

### Log Format
Each log entry includes the request ID:
```
[550e8400-e29b-41d4-a716-446655440000] assigning job job123 to region us-west
[550e8400-e29b-41d4-a716-446655440000] assigned job job123 to driver driver456
```

## Monitoring

### Key Metrics to Watch
- **Response time (p99)**: Should be <100ms when drivers available, 10s when timeout
- **Error rate (503s)**: Should be <0.1% in normal operation
- **Error rate (500s)**: Should be 0% (indicates bugs)
- **Request latency distribution**: Bimodal (fast if drivers available, 10s if timeout)

### Alerts to Set Up
- **Replica health**: If `/health` fails on >1 replica, page on-call
- **High 503 rate**: If >1% of requests return 503 for >5 min, check driver fleet
- **High 500 rate**: Any 500 errors should trigger investigation (likely bug)

## Environment Variables

- `PORT`: Server port (default 3000)
- `ASSIGN_TIMEOUT_MS`: Max time to wait for available driver in ms (default 10000)

Example for faster timeout:
```bash
ASSIGN_TIMEOUT_MS=5000 npm start
```

## Rollback

If a deployment causes issues:
1. Verify the issue is the new deployment (check version in logs: `grep "Dispatch API listening"`)
2. Revert to previous container image
3. Restart all 3 replicas
4. Verify health checks pass on all replicas

## Known Limitations

- **No persistence**: Driver state is lost on restart. All drivers must re-register.
- **No driver redundancy**: If a driver goes down, its assigned job is not automatically re-assigned.
- **Regional isolation**: A region outage causes 503 errors immediately (by design, to fail fast).
