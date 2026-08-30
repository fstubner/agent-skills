# Operations

## Signals

HTTP status rates and latency, plus structured request logs with request id, payment id, account hash, status, and duration, land in the service log aggregator. The current dependency-free server does not emit logs yet; production middleware must provide these fields.

## Alerts

Page on 5xx > 1% for 5 minutes or p95 latency above the API SLO for 10 minutes; first response is halt promotion and rollback to the previous immutable artifact.

## Failure modes

Database migration failure appears as readiness failure; refund contention appears as elevated 409s; an application regression appears as elevated 5xxs. Thresholds are initial operational values and must be tuned from production baselines.

## Recovery

Use the literal rollback command in `RELEASE.md`; the schema is forward-only and refund rows are retained. Restarting is safe because committed refunds and idempotency keys persist in PostgreSQL.
