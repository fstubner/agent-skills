# Operations

## Signals

The HTTP health signal is a successful process accepting requests; production
structured request logs must include request id, route, status, latency, and
account hash. PostgreSQL errors are emitted to the central structured logger.

## Alerts

Page on 5xx above 1% for 5 minutes or p95 latency above 500ms for 5 minutes;
halt the rollout and use the rollback command below. Thresholds are initial
operational values and should be recalibrated from baseline traffic.

## Failure modes

Database unavailable: refund requests return 5xx and error-rate alerts fire.
Concurrent refunds: the PostgreSQL payment-row lock and transaction are
required; an implementation that omits them risks overspending the balance.

## Recovery

Run `kubectl -n payments rollout undo deployment/refund-ledger` to restore the
previous application artifact. Do not roll back migrations: 002/003 contain
only additive schema changes and existing refund rows are retained.
