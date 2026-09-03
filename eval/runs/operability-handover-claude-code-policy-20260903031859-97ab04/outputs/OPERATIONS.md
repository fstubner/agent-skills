# Dispatch API Operations Guide

## Quick Start for On-Call

### Verify the API is running
```bash
curl http://localhost:3000/health/live
```
Expected: `{"status": "alive"}` (200 OK)

### Check if API can handle requests
```bash
curl http://localhost:3000/health/ready
```

**Expected (ready)**:
```json
{
  "ready": true,
  "driverCount": 42,
  "busyCount": 15,
  "freeCount": 27
}
```
Status: 200 OK

**Expected (not ready)**:
```json
{
  "ready": false,
  "reason": "no drivers available",
  "driverCount": 0,
  "freeCount": 0
}
```
Status: 503 Service Unavailable

### Assign a job (normal operation)
```bash
curl -X POST http://localhost:3000/jobs/job-123/assign \
  -H "Content-Type: application/json" \
  -d '{"region": "us-west"}'
```

**Successful response**:
```json
{"driver": "driver-42"}
```
Status: 200 OK
Header: `X-Request-ID: 550e8400-e29b-41d4-a716-446655440000`

**Errors**:
- `400` + `{"error": "region is required"}` - Missing region in request
- `503` + `{"error": "no available drivers (timeout)"}` - All drivers busy > 30s
- `500` + `{"error": "could not assign"}` - Internal error

## Debugging a Problem

### Step 1: Get the request ID
When a client reports an issue, ask for or find the timestamp and get the request ID from logs:
```bash
# Example: find requests to us-west region around 14:30:00
grep '"region":"us-west"' app.log | grep '14:3[0-9]:[0-9][0-9]'
```

### Step 2: Trace the request
Use the `requestId` to find all logs for that request:
```bash
REQID="550e8400-e29b-41d4-a716-446655440000"
grep "$REQID" app.log
```

Output shows:
- When request arrived (`assign request start`)
- How long it took (`durationMs`)
- What went wrong (error message and errorCode)

**Example trace output**:
```json
{"timestamp":"2025-09-03T14:30:15.123Z","level":"info","message":"assign request start","requestId":"550e8400","durationMs":2,"jobId":"job-123","region":"us-west"}
{"timestamp":"2025-09-03T14:30:45.234Z","level":"error","message":"assign failed","requestId":"550e8400","durationMs":30015,"jobId":"job-123","region":"us-west","error":"assign timeout","errorCode":"ASSIGN_TIMEOUT","status":503}
```

This trace shows:
- Request arrived at 14:30:15
- Took 30+ seconds (hit timeout)
- No drivers available in us-west at that time

## Monitoring

### Critical Alerts

1. **Liveness failing** (`/health/live` returns error)
   - Server is down or unresponsive
   - **Action**: Restart immediately

2. **Readiness failing for > 2min** (`/health/ready` returns 503)
   - No drivers in the system
   - **Action**: Check driver service, check regional health

3. **Assignment timeout rate > 10%**
   - Drivers consistently fully booked
   - **Action**: Scale drivers or throttle requests

4. **Error rate > 5%**
   - Something is broken
   - **Action**: Check logs, look for patterns in errorCode field

### Log Aggregation

All logs are JSON. Configure your log collector to:
1. Parse JSON fields automatically
2. Index by `requestId` for tracing
3. Alert on `level: error` or `errorCode` fields
4. Track `durationMs` for performance trending

### Metrics to Export

From logs, extract and graph:
- `assign success` count (successful assignments)
- `assign failed` with `errorCode=ASSIGN_TIMEOUT` (capacity issues)
- `assign failed` with `errorCode=ASSIGN_FAILED` (bugs)
- Request duration percentiles (p50, p95, p99)
- Driver stats from `/health/ready` (driverCount, freeCount)

## Scaling

### What to do when assignment timeout rate is high

1. Check readiness: `curl http://localhost:3000/health/ready`
2. If `freeCount` is low: drivers are at capacity
   - Scale up driver instances
   - Redistribute traffic to less-loaded regions
3. If `driverCount` is 0: initialization failed
   - Restart this API instance
   - Check driver service connectivity
4. If `driverCount` high but `freeCount` is 0: drivers stuck busy
   - Bug in driver management
   - Restart drivers in that region

## Deployment Checklist

- [ ] Dependencies installed: `npm install`
- [ ] Environment variable set: `PORT` (or defaults to 3000)
- [ ] Server starts cleanly: `npm start`
- [ ] Liveness check responds: `curl http://localhost:3000/health/live`
- [ ] Readiness check responds: `curl http://localhost:3000/health/ready`
- [ ] Logs are being written to stdout in JSON format
- [ ] Log aggregation configured to parse JSON
- [ ] Monitoring dashboards configured with metrics from logs
- [ ] Runbook linked in alert destinations
- [ ] On-call engineer has access to logs and dashboards

## Troubleshooting

### "drivers is not defined" or module errors
- Node.js modules may be missing
- Run: `npm install`
- Restart service

### Requests hanging for > 30 seconds
- Expected behavior: timeout after 30s
- Check readiness endpoint to see if drivers available
- If no drivers: scale drivers up

### Inconsistent error messages
- All errors are logged with requestId
- Use request ID to trace exact error cause
- Check logs for full error details

### Port already in use
- Set different PORT: `PORT=3001 npm start`
- Or: kill existing process and restart

## Additional Resources

- **Runbook**: RUNBOOK.md (issue types and resolutions)
- **Source code**: src/server.js, src/assign.js
- **Tests**: test/assign.test.js
- **Package manifest**: package.json

---

**Last updated**: 2025-09-03
**API Version**: Dispatch v1.0
