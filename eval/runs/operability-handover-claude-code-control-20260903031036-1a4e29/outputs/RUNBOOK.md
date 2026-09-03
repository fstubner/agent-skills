# Dispatch API Operational Runbook

## Overview
The Dispatch API assigns drivers to jobs in specified regions. It is a stateful, single-instance service that maintains an in-memory registry of drivers.

## Health Checks

### Primary Health Endpoint
```
GET /health
```

Returns JSON with status and diagnostics:
- `status`: "healthy" or "degraded"
- `drivers.total`: Total registered drivers
- `drivers.free`: Available drivers
- `drivers.busy`: Currently assigned drivers
- `assignments.pending`: Number of requests waiting for driver assignment
- `assignments.oldestPendingMs`: Age of oldest pending request in milliseconds

**Degraded status** is triggered when any assignment has been pending for >30 seconds, indicating a regional outage or driver shortage.

### Health Indicators
- **Healthy**: All `/jobs/:id/assign` requests complete within 30 seconds
- **Degraded**: At least one assignment is pending for >30 seconds
- **Critical**: Service is not responding to requests

## Monitoring

### Key Metrics to Track
1. **Response time of `/jobs/:id/assign`**: Should be <100ms under normal conditions. If consistently >1s, indicates driver shortage.
2. **Health endpoint `assignments.oldestPendingMs`**: Should always be <5000ms. If >30000ms, indicates regional outage.
3. **Health endpoint `drivers.free`**: Should be >0 for the region being requested. If 0, requests will timeout.
4. **Log entries with level="warn" or level="error"**: Indicates operational issues.

### Alerting Rules
- **Alert if** `/health` returns 503 status for >5 minutes
- **Alert if** response times exceed 30 seconds
- **Alert if** `drivers.free` is 0 for any region

## Troubleshooting

### Symptom: Requests Timing Out (Pending >30s)
**Likely causes:**
- **Regional outage**: All drivers in the requested region are busy or offline
- **Insufficient driver capacity**: Not enough drivers registered for the region

**What to do:**
1. Check `/health` endpoint - look at `drivers` metrics by inspecting logs
2. Review recent assignment logs to identify which region is affected
3. If regional outage: Wait for drivers to come back online or escalate to infrastructure team
4. If insufficient capacity: Scale drivers or reduce job load in that region

**Diagnostics:**
```bash
curl http://localhost:3000/health | jq .
```

Look for regions with `drivers.free` = 0 and `assignments.pending` > 0.

### Symptom: Health Endpoint Returns 503
**What to do:**
1. Check if the service is still running: `curl http://localhost:3000/health`
2. If no response: Service is down - restart with `npm start`
3. If response but status=503: There's a pending assignment >30s old
   - Check logs for requests with `oldestPendingMs` >30000
   - See "Requests Timing Out" section above

### Symptom: Seeing Assignment Failures in Logs
**Error message**: "could not assign"

**Possible causes:**
- Temporary error in assign logic (rare, should not happen)
- Request cancelled mid-assignment

**What to do:**
1. Check the request logs for the associated `requestId`
2. Note the `region` field - if it's a specific region, likely a regional issue
3. Retry is safe - the API is idempotent (reassigning same job is safe)

## Request Tracing

Every request generates a unique `requestId` in logs. Use this to trace a specific job assignment:

```bash
# Search logs for a job
grep "jobId.*<job_id>" logfile.txt

# All events for a request
grep "requestId.*<request_id>" logfile.txt
```

### Log Format
All logs are JSON with these fields:
- `timestamp`: ISO 8601 timestamp
- `level`: "info", "warn", or "error"
- `message`: Human-readable message
- `requestId`: Unique request identifier (if applicable)
- Other fields depend on the event type

## Common Operations

### Restart the Service
```bash
npm start
```
Service listens on port 3000 (or `$PORT` environment variable if set).

### Check Current System State
```bash
curl http://localhost:3000/health
```

### View Logs
Logs are written to stdout as JSON. Pipe to a JSON pretty-printer for readability:
```bash
# Live logs with filtering
npm start | jq 'select(.level != "info")'  # Show only warnings and errors
```

## Escalation Procedure

1. **Service not responding** → Restart service (see "Restart the Service")
2. **Persistent 503 status** → Check driver availability; if all regions are full, escalate to demand team
3. **Errors in logs** → Review request traces (see "Request Tracing") and pass details to development team
4. **Unknown issues** → Collect logs with context (`/health` output, recent request traces) and escalate to development

## Architecture Notes

- **Single instance**: This service runs as a single process. Multiple instances require external driver coordination.
- **In-memory state**: All driver state is in memory; restarting clears all assignments.
- **No persistence**: Driver registry and busy status are not persisted to disk.
- **Regional dispatch**: Driver assignment is region-specific; ensure drivers are registered with correct region.

## SLA Expectations

- **Assignment latency**: <100ms under normal load (one free driver per region)
- **Availability**: Should handle sustained requests without degradation
- **Failure mode**: Graceful degradation (new requests queue waiting for a free driver) vs. failure (no drivers will ever become free)
