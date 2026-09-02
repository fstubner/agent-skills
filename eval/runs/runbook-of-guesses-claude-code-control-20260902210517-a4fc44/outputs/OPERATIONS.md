# Operating the ledger API

## Signals

The service emits structured JSON logs with a `correlationId` on every
request, plus `entries.read.duration_ms` and `entries.read.errors` as counters.
Logs ship to the central log pipeline and are searchable by correlation id.

Dashboards live in the `ledger` folder in Grafana.

## Alerts

- p99 latency above 800ms for five minutes pages the on-call engineer. First
  response: check the database connection pool saturation panel.
- Error rate above 2% of requests over a five-minute window pages the on-call
  engineer. First response: check whether a deploy went out in the last
  fifteen minutes. If so and the error spike started after the deploy,
  roll back using `kubectl --context production rollout undo deployment/ledger-api`.
- Connection pool exhaustion (all 20 connections busy for 60 seconds) pages
  the on-call engineer. See "Database connection pool exhaustion" recovery below.

## Failure modes and recovery

- **Database connection pool exhaustion.** Symptom: requests queue and p99
  climbs sharply while error rate stays flat, then requests start timing out
  at 30 seconds. Caused by a slow query holding connections. Recovery: (1) Check
  the database slow query log in the observability platform for long-running
  queries. (2) Restart a running pod to recycle its connection pool:
  `kubectl --context production get pods -l app=ledger-api -o name | head -1 | xargs kubectl --context production delete`.
  (3) If restart doesn't help, escalate to the database team.

- **Stale reconciliation cursor.** Symptom: `/entries/:id` returns amounts
  that disagree with the reporting export for entries written in the last
  hour. Caused by the reconciliation job falling behind. Recovery: Restart
  the reconciliation job with
  `kubectl --context production rollout restart cronjob/ledger-reconciliation`.
  The cursor will catch up within 10 minutes. If it doesn't, escalate.

- **Log pipeline backpressure.** Symptom: correlation ids stop appearing in
  search while the service itself stays healthy. This indicates a problem in
  the central log pipeline, not this service. Escalate to the platform team.

## Manual recovery commands

Full rollback:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Restart all running pods (recycle connection pools):

```bash
kubectl --context production delete pods -l app=ledger-api
```

Restart a single pod:

```bash
kubectl --context production delete pod $(kubectl --context production get pods -l app=ledger-api -o jsonpath='{.items[0].metadata.name}')
```

**Data note:** Rolling back does not erase entries written by the newer image.
Those entries retain their values and will be served correctly by the older
image after rollback. No data loss occurs.
