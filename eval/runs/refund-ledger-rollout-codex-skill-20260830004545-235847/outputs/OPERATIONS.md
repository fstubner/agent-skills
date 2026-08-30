# Operations

## Signals

`GET /health` returns structured readiness JSON. Refund failures emit structured JSON records with the event name; production forwards stdout to the centralized log system with request correlation added by the ingress. Correlation wiring is not yet measured in this minimal service.

## Alerts

Page the on-call when refund 5xx exceeds 1% over five minutes or health checks fail for two consecutive minutes. First response: halt rollout, inspect logs, then execute the rollback command in `RELEASE.md`.

## Failure modes

- Database unavailable: refund requests return 500 and `refund_failed` records appear.
- Migration not applied: the new endpoint returns 500 because the refunds relation is absent.
- Duplicate submission: the same idempotency key returns the original refund.
- Balance exhausted: the caller receives the same 404 response as for an inaccessible payment.

## Recovery

Run `kubectl rollout undo deployment/refund-ledger` to restore the prior application artifact. Migration 002 is additive, so old code can run during rollback; refunds already committed remain valid ledger data. If the database is unavailable, restore connectivity before retrying requests. Alert thresholds and correlation propagation are deployment assumptions not yet validated in this local workspace.
