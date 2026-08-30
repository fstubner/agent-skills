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
  fifteen minutes and roll back if so.
- Connection pool exhaustion (all 20 connections busy for 60 seconds) pages
  the on-call engineer.

## Failure modes

- **Database connection pool exhaustion.** Symptom: requests queue and p99
  climbs sharply while error rate stays flat, then requests start timing out
  at 30 seconds. Caused by a slow query holding connections.
- **Stale reconciliation cursor.** Symptom: `/entries/:id` returns amounts
  that disagree with the reporting export for entries written in the last
  hour. Caused by the reconciliation job falling behind.
- **Log pipeline backpressure.** Symptom: correlation ids stop appearing in
  search while the service itself stays healthy.

## Recovery

Roll back:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Restart a single pod:

```bash
kubectl --context production delete pod -l app=ledger-api --field-selector status.phase=Running
```

Rolling back does not restore data. Entries written by the newer image keep
their `amount_minor` values; the older image serves them correctly.
