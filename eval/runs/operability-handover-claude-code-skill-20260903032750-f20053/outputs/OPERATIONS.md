# Operations

## Signals

**Health endpoint:** GET `/healthz` returns `200 OK` with `{ status: "healthy" }` when the service is running normally.

**Structured logging:** Service emits JSON logs to stdout, with each line containing:
- `request_id`: Correlation ID from `X-Request-Id` header (or auto-generated UUID)
- `timestamp`: ISO 8601 timestamp
- `level`: Log level (info, error)
- `event`: Event type (server_started, assigning_job, assign_success, assign_failed)
- Additional fields specific to the event (job_id, region, driver_id, error, etc.)

Logs are intended for shipping to a centralized log aggregator (e.g., Loki, CloudWatch). All logs include `request_id` to enable end-to-end request tracing across services.

## Alerts

- **5xx error rate > 2% over 5 minutes** → Page on-call
  - First response: Check `/healthz` endpoint status
  - Possible causes: upstream service (driver registry) unavailable, or no drivers available for assigned region
  - Next step: Follow Recovery section below

- **Response latency p99 > 35 seconds** → Page on-call
  - Indicates jobs waiting longer than configured timeout (default 30s) for available drivers
  - First response: Check how many drivers are currently active and assigned (would require metrics instrumentation)
  - Likely cause: Regional outage or insufficient driver capacity

## Failure modes

- **No drivers available for a region** → Request times out after 30 seconds (configurable via `ASSIGN_TIMEOUT_MS` env var) and returns 500 with `{ error: "could not assign" }`. Error logs show the region and timeout details.

- **Driver registry unavailable** → Without driver data, no drivers match any region, all assignment requests timeout. Same symptom as above.

- **High concurrent assignment load** → Multiple jobs competing for same pool of drivers. With only a polling-based lookup (100ms intervals), under heavy load availability latency increases. Not a failure, but degrades response time approaching the timeout.

## Recovery

**Rollback:** See `deploy/rollout.md` for kubectl command.
```
kubectl rollout undo deploy/dispatch --to-revision=<previous-revision>
```
Safe, no data loss. Drivers in-flight are not persisted; re-assignment can be triggered for jobs without assigned drivers.

**Restart service:**
```
kubectl rollout restart deploy/dispatch
```
Restarts all three replicas in a rolling update. In-flight assignments are lost (driver state is in-memory), and jobs will need re-assignment. No persistent data is at risk.

**Scale up drivers:** If alerts indicate capacity issue but service is otherwise healthy, scale driver services:
```
kubectl scale deploy/driver-manager --replicas=<desired-count>
```

**Increase timeout:** If frequent timeouts but drivers are available, increase the ASSIGN_TIMEOUT_MS environment variable (default 30000ms). Requires a rollout to update.

**Not yet measured:** The time to first driver availability in real deployments, and whether 30s is an appropriate SLA for job assignment latency.
