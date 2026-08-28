# Operations

## Signals

The service emits structured JSON logs with correlation IDs for request tracing. Each log entry includes:

```json
{
  "timestamp": "2026-08-29T12:34:56.789Z",
  "level": "info|error",
  "message": "event_name",
  "requestId": "a1b2c3d4e",
  "jobId": "...",
  "driverId": "...",
  "region": "...",
  "durationMs": 123,
  "error": "..."
}
```

**Key signals to monitor:**
- `assign_start` — job assignment request received. Fields: `requestId`, `jobId`, `region`
- `assign_success` — driver assigned to job. Fields: `requestId`, `jobId`, `driverId`, `durationMs`. High `durationMs` indicates driver shortage
- `assign_failed` — assignment failed (no drivers available or timeout). Fields: `requestId`, `jobId`, `error`
- `server_started` — service initialized. Fields: `port`

**Health endpoint:** `GET /health` returns `{"status": "ok"}` when the process is running.

**Readiness endpoint:** `GET /ready` returns `{"ready": true, "drivers": N}` (200 OK) when drivers are registered. Returns 503 if no drivers are available.

## Alerts

**Page on assign latency spike (P1):**
- Threshold: >5 second assignment time (log: `durationMs > 5000`)
- First response: Check driver utilization. If all drivers in the region are busy, contact dispatch team to add capacity. If drivers are free, this indicates a bug in assignment logic.

**Page on assign failures (P1):**
- Threshold: >5% of requests fail (log: error count / total request count)
- First response: Check readiness probe. If `/ready` returns 503, drivers are not registered. Verify driver registration service is healthy. If drivers are registered but requests fail, check service logs for blocking calls.

**Page on readiness failure (P2):**
- Threshold: `/ready` returns 503 for >30 seconds
- First response: This indicates no drivers are available or the driver registry is corrupted. Restart the service to reset the in-memory driver state. If drivers should be present, contact the driver provisioning team.

## Failure Modes

**1. Assignment hangs indefinitely (drivers not available)**
- Symptom: Requests to `POST /jobs/:id/assign` never return; `durationMs` is very high or request times out at load balancer
- Cause: Requested region has no drivers, or all drivers are permanently busy due to a bug
- Detection: Readiness probe `/ready` returns 503, OR assignment duration exceeds threshold
- Resolution: See Recovery section — increase driver capacity or restart service

**2. Driver registry is stale or corrupted**
- Symptom: `/ready` returns 503 but drivers should be available; or successful assignments return driver IDs that don't exist
- Cause: In-memory `DRIVERS` map is not being populated by driver registration service, or registration has stalled
- Detection: `/ready` returns 503 for extended time despite no production issues reported
- Resolution: Restart the service to reset the registry. Investigate driver registration service health independently.

**3. Request timeout at load balancer**
- Symptom: Client receives 504 Gateway Timeout; logs show `assign_start` but no `assign_success` or `assign_failed`
- Cause: Assignment is hanging due to no drivers available; request exceeded load balancer's timeout (typically 30-60 seconds)
- Detection: High latency in assignment logs (`durationMs > 30000`) followed by no completion
- Resolution: Same as failure mode 1 — add driver capacity or trigger manual restart

**4. Service crashes during high load**
- Symptom: `/health` stops responding; no new logs after a successful assignment
- Cause: Memory leak, uncaught exception, or resource exhaustion
- Detection: Health probe fails; previous logs show normal operation, then silence
- Resolution: Restart the service immediately. Review error logs in previous replica instance (if Kubernetes still has them). Do not redeploy; restart current version first.

## Recovery

**For assignment hangs (no drivers available):**
1. Immediate: Page on-call dispatch team to add drivers to the region
2. Workaround: Restart the service to clear any stuck state — `kubectl rollout restart deploy/dispatch`
3. Rollback (if this is a fresh deploy causing the issue): `kubectl set image deploy/dispatch api=PREVIOUS_IMAGE` where PREVIOUS_IMAGE is the prior stable version

**For driver registry corruption:**
1. Immediate: Restart the service — `kubectl rollout restart deploy/dispatch`
2. Verify recovery: Run `curl -s http://SERVICE_IP:3000/ready` and confirm it returns 200 with `"ready": true`
3. If still fails: Check driver registration service logs. Service is dependent on driver provisioning.

**For failed deploy / service not starting:**
1. Check if service is running: `kubectl get pods -l app=dispatch`
2. If pod is CrashLoopBackOff, read the logs: `kubectl logs -p deploy/dispatch` (previous container) or `kubectl logs deploy/dispatch` (current)
3. Rollback to previous image: `kubectl set image deploy/dispatch api=PREVIOUS_IMAGE`
4. Verify rollback: `curl -s http://SERVICE_IP:3000/health` should return 200 within 30 seconds

**For partial outage (1 replica failing):**
Rolling update configuration (3 replicas, 1 at a time) means the service remains available. No manual action needed; let the deployment fail the unhealthy replica and re-provision. Monitor dashboards to ensure traffic does not shift to overloaded replicas.

**Data at risk:**
- In-memory `DRIVERS` registry: Lost on restart. **Non-critical** — driver registration service will re-populate on reconnect.
- Assignment requests in flight: Requests timeout at load balancer and must be retried by client. Restarting does not risk data loss.

**Smoke test after recovery:**
```bash
# 1. Verify health
curl -s http://SERVICE_IP:3000/health | jq .

# 2. Verify readiness
curl -s http://SERVICE_IP:3000/ready | jq .

# 3. Test assignment (requires a registered driver)
curl -X POST http://SERVICE_IP:3000/jobs/job-123/assign \
  -H 'Content-Type: application/json' \
  -d '{"region": "us-west-1"}' | jq .
```

Successful recovery: All endpoints return 200, readiness shows drivers available, and assignment returns a driver ID.
