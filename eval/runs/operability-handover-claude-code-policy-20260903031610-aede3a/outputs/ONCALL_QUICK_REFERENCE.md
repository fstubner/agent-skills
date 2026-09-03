# On-Call Quick Reference - Dispatch API

## Is the API healthy?
```bash
curl http://localhost:3000/health
# 200 ✓ = Healthy
# 503 ✗ = Degraded (no drivers)
```

## Why is assignment failing?
1. Get trace ID from error response: `x-trace-id: abc123`
2. Find logs with that trace ID: `grep abc123 /var/log/dispatch.log`
3. Look for the error type:
   - `no_available_driver` → No free drivers in that region (wait or scale up)
   - `region required` → Client didn't send region in request body
   - `assign_failed` → Unexpected error (check logs, restart if persistent)

## Assignment takes 30 seconds, then fails?
This is expected behavior:
- Service waits up to 30 seconds for a driver to become available
- If none available after 30 seconds → returns 504 error
- **What to do:** Check health (`curl http://localhost:3000/health`), increase drivers or wait for existing jobs to complete

## Restart the service
```bash
# Stop
pkill -f "node src/server.js"

# Start
npm start
```

After restart:
- All in-memory driver state is lost
- Previous jobs will timeout after ~30 seconds
- Drivers need to re-register with the service

## Configure timeout (if needed)
```bash
export ASSIGN_TIMEOUT_MS=60000
npm start
# Now assignments wait 60 seconds instead of 30
```

## Understanding log entries
Each log line is JSON with:
- `timestamp`: When it happened
- `traceId`: Request ID (use to correlate logs)
- `level`: info / warn / error
- `msg`: What happened (e.g., `assign_start`, `health_check`, `assign_success`)
- Other fields: jobId, region, driverId, status, error

**Example: Successful assignment**
```
{"timestamp":"2026-09-03T14:22:10Z","traceId":"xyz","level":"info","msg":"assign_start","jobId":"j1","region":"us-west"}
{"timestamp":"2026-09-03T14:22:10Z","traceId":"xyz","level":"info","msg":"assign_success","jobId":"j1","driverId":"d5"}
```

**Example: Timeout**
```
{"timestamp":"2026-09-03T14:22:10Z","traceId":"xyz","level":"info","msg":"assign_start","jobId":"j2","region":"us-east"}
{"timestamp":"2026-09-03T14:22:40Z","traceId":"xyz","level":"error","msg":"no_available_driver","region":"us-east","error":"assign_timeout"}
```

## What is this API?
- Assigns drivers to jobs
- One driver per job
- Drivers grouped by region
- Once assigned, driver marked as busy
- Runs entirely in memory (no database)

## Important: Server restart loses all state
- All drivers "forget" they exist
- All ongoing assignments get timeout errors
- No persistence between restarts
- Plan to migrate to persistent storage before scaling

## Still stuck?
1. Restart the service (nuclear option, loses state)
2. Check if driver registration service is running separately
3. Escalate to engineer on-call
4. Share full logs with trace ID from the failing request
