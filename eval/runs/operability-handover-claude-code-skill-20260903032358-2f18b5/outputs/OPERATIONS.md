# Dispatch API Operations Runbook

## Signals

### Health and Readiness Endpoints

- **`GET /health`** — Liveness probe. Returns HTTP 200 with `{"status":"ok"}` if the process is running. Does not guarantee request handling is functional.
  - **Where it lands**: Load balancer health checks, Kubernetes liveness probe
  - **SLO**: Must respond within 100ms

- **`GET /ready`** — Readiness probe. Returns HTTP 200 with `{"ready":true,"drivers":N}` if at least one driver is registered. Returns HTTP 503 if no drivers are available in the system.
  - **Where it lands**: Load balancer readiness checks, Kubernetes readiness probe, deployment gates
  - **SLO**: Must respond within 100ms

### Structured Logging

All logs are emitted as JSON to stdout with the following fields:
- `timestamp` (ISO 8601) — UTC time of the log event
- `level` — `info`, `error`, or `debug`
- `message` — Event name (e.g., `assignment_started`, `assignment_completed`, `assignment_failed`)
- `correlationId` — UUID, stable across a single request lifecycle; use this to trace a request end-to-end
- Additional fields relevant to the event (e.g., `jobId`, `region`, `driverId`, `error`)

**Sample logs:**
```json
{"timestamp":"2024-09-03T14:22:10.123Z","level":"info","message":"server_started","correlationId":null,"port":3000}
{"timestamp":"2024-09-03T14:22:11.456Z","level":"info","message":"assignment_started","correlationId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","jobId":"job_123","region":"us-west"}
{"timestamp":"2024-09-03T14:22:11.789Z","level":"info","message":"assignment_completed","correlationId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","jobId":"job_123","driverId":"driver_456"}
```

### Metrics to Watch

- **Request rate** — Counter of POST /jobs/:id/assign requests per minute; baseline ~10-50 req/min in normal load
- **Assignment latency** — Time from request arrival to response sent; baseline 10-50ms when drivers are available
- **Assignment timeout rate** — Requests that don't complete within 30 seconds; should be <0.1% under normal conditions
- **Error rate** — Requests returning HTTP 5xx; should be <0.5% under normal conditions
- **Driver availability** — Number of free drivers in the system; should be >0 at all times during business hours

## Alerts

### Critical Alerts (Page Immediately)

1. **Readiness Check Failing** — `/ready` returns HTTP 503
   - **Threshold**: If failing for >30 seconds continuously
   - **Symptom you'll see first**: New requests start failing with "could not assign" or timeout
   - **First response**: Check [Failure mode: Regional outage or no drivers registered](#failure-modes)

2. **Assignment Timeout Rate Spike** — Requests don't complete within 30 seconds
   - **Threshold**: >5% of requests in a 1-minute window
   - **Symptom you'll see first**: Requests hang, client timeouts increase, correlationIds accumulate in logs without completion
   - **First response**: Check [Failure mode: Infinite assignment loop](#failure-modes)

3. **Error Rate Spike** — HTTP 5xx responses
   - **Threshold**: >5% of requests in a 1-minute window
   - **Symptom you'll see first**: Assignment requests fail with HTTP 500; error logs show "assignment_failed"
   - **First response**: Check service logs for exceptions; if none visible, check [Recovery: Restart](#recovery)

### Warning Alerts (Notify Team, Non-Blocking)

- **Assignment latency** — p95 latency >1000ms for 2+ minutes (may indicate region overload or driver shortage)
- **Driver availability trending down** — Free drivers <10% of total for 5+ minutes (suggests sustained high load)

## Failure modes

### Regional Outage or No Drivers Registered

**Symptom**: `/ready` endpoint returns HTTP 503 with `{"ready":false,"drivers":0}`

**Root causes**:
- No drivers have registered with the dispatch system yet (startup condition)
- All drivers in all regions have crashed or disconnected
- A specific region requested has no drivers (partial outage)

**How to verify**:
1. Check logs for recent driver registration/deregistration events (if this API implements driver registration; currently not present)
2. Check downstream dependency (driver registry service) status
3. Query `/ready` endpoint; if `drivers: 0`, no drivers are known to the system

**Investigation**: Look for `assignment_failed` log entries with high volume; correlate with driver system changes in other services.

### Infinite Assignment Loop (Timeout)

**Symptom**: Requests to POST /jobs/:id/assign hang indefinitely or timeout after client-side timeout (typically 30-60s); logs show `assignment_started` but never `assignment_completed` for a given correlationId

**Root cause**: The assign() function loops forever when no free drivers exist in the requested region, with no timeout or backpressure mechanism.

**Why it happens**:
- A region has drivers, but all are currently busy for an extended period
- Load exceeds driver capacity in that region
- A driver claims to be busy but never releases (dead driver connection)

**How to verify**:
1. Search logs for a correlationId with `assignment_started` but no matching `assignment_completed` or `assignment_failed`
2. Check if `/ready` returns drivers >0 (if drivers exist but all busy, that's this mode)
3. Measure how many requests are stuck; if >10 outstanding, this is happening

**Known limitation**: This is a design issue in the assign() function; see note in src/assign.js. Requests will hang under sustained regional overload.

### Service Crash or Memory Leak

**Symptom**: Server becomes unresponsive; `/health` stops responding; logs stop emitting

**Root cause**:
- Out of memory (OOM) — the DRIVERS map accumulates state that grows unbounded
- Uncaught exception in the request handler
- Process killed by the platform (e.g., container OOMKilled)

**How to verify**:
1. Check if the process is still running: `ps aux | grep "node src/server.js"`
2. Check container/VM logs for OOM events or process termination signals
3. If process is down, see [Recovery: Restart](#recovery)

## Recovery

### Restart

**Symptom**: Service is down or deeply broken; no recovery short of a full restart

**Procedure**:
```bash
# 1. Stop the current process
pkill -f "node src/server.js"

# 2. Wait for it to shut down
sleep 2

# 3. Verify it's gone
ps aux | grep "node src/server.js" | grep -v grep

# 4. Start the service
npm start &

# 5. Wait for readiness
sleep 3

# 6. Verify readiness
curl -i http://localhost:3000/ready
```

**Data at risk**: The DRIVERS map (in-memory driver registry) is lost. If drivers were marked busy, they will come back as available after restart. Requests in-flight are lost. Clients must retry.

**Expected behavior after restart**:
- `/health` responds immediately with 200
- `/ready` may return 503 briefly until drivers reconnect (from whatever system registers them)
- Once drivers are registered, `/ready` returns 200 and new assignment requests can proceed

### Rollback to Previous Version

**Procedure**:
```bash
# 1. Identify the previous good version (e.g., from your deployment system or git)
# Assuming it's tagged as 'v1.0.0' and current is 'v1.0.1'

# 2. Stop the current process
pkill -f "node src/server.js"

# 3. Check out the previous version
git checkout v1.0.0

# 4. Reinstall dependencies
npm install

# 5. Start the service
npm start &

# 6. Verify health
curl -i http://localhost:3000/health
curl -i http://localhost:3000/ready
```

**Safety note**: If the issue is a corrupt DRIVERS state or a code bug, restart (above) clears in-memory state. If the issue is a schema change or data corruption, ensure the previous version can still read the current state, or perform a full database reset if applicable.

**Decision point**: 
- If the symptom is a timeout/hang in a specific region → restart and monitor
- If the symptom is a logic error in assignments → rollback to previous version
- If the symptom is state corruption → restart AND check if previous version handles the state

### Monitor After Recovery

After a restart or rollback:

1. **For 5 minutes**: Watch the error rate and latency
   ```bash
   tail -f /path/to/stdout.log | grep -E '"level":"error"'
   ```

2. **Verify assignments are working**: Send a test assignment request with a known good region
   ```bash
   curl -X POST http://localhost:3000/jobs/test-123/assign \
     -H "Content-Type: application/json" \
     -d '{"region":"us-west"}'
   ```

3. **Check readiness**:
   ```bash
   curl -i http://localhost:3000/ready
   ```

4. **If error rate remains high after 2 minutes**: escalate to the team that owns the driver registry or dispatch logic

---

## Known Unknowns

These are gaps in this runbook that should be filled in as the system runs in production:

1. **Driver registration mechanism** — This runbook assumes drivers somehow appear in the DRIVERS map, but there's no visible endpoint or mechanism for driver registration. How do drivers get registered? How do they deregister or heartbeat?

2. **Regional capacity baseline** — The runbook assumes you know what "drivers <10%" means, but we haven't measured baseline driver counts per region. Capture this data from the first week of production.

3. **Assignment latency SLO** — We assume 10-50ms is baseline, but this is a guess. After 48 hours of production traffic, measure p50, p95, p99 latency and update the thresholds.

4. **Timeout threshold** — The 30-second timeout for "timeout rate spike" is arbitrary. Measure actual client timeouts and set this threshold to 95th percentile + 5 seconds.

5. **Regional outage detection** — If a specific region has no drivers, we don't have a way to distinguish "drivers are rebooting" (transient) from "drivers are down" (incident). Add a mechanism to report driver health per region.

6. **Driver lifecycle events** — Logs don't currently emit driver registration, disconnection, or heartbeat events. These should be added to trace driver-side issues that impact assignment latency.
