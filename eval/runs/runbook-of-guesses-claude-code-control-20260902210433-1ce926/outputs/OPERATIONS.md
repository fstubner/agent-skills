# Operating the ledger API

## Signals

The service emits structured JSON logs with a `correlationId` on every
request, plus `entries.read.duration_ms` and `entries.read.errors` as counters.
Logs ship to the central log pipeline and are searchable by correlation id.

Dashboards live in the `ledger` folder in Grafana.

## Alerts

- p99 latency above 800ms for five minutes pages the on-call engineer. First
  response: check the database connection pool saturation panel. If pool is
  not saturated, look for slow queries in the database logs.
- Error rate above 2% of requests over a five-minute window pages the on-call
  engineer. First response: check whether a deploy went out in the last
  fifteen minutes and roll back if so.
- Connection pool exhaustion (all 20 connections busy for 60 seconds) pages
  the on-call engineer. First response: follow the "Database connection pool
  exhaustion" recovery steps below.

## Failure modes and recovery

- **Database connection pool exhaustion.** Symptom: requests queue and p99
  climbs sharply while error rate stays flat, then requests start timing out
  at 30 seconds. Caused by a slow query holding connections. Recovery: restart
  a pod to clear the connection pool (see "Restart a single pod" below), then
  coordinate with the database team to identify and fix the slow query.

- **Stale reconciliation cursor.** Symptom: `/entries/:id` returns amounts
  that disagree with the reporting export for entries written in the last
  hour. Caused by the reconciliation job falling behind. Recovery: restart the
  reconciliation job pod with:
  ```bash
  kubectl --context production delete pod -l app=ledger-reconciler
  ```
  Wait 30 seconds for the pod to restart. If the issue persists, check the
  reconciliation job logs in Grafana.

- **Log pipeline backpressure.** Symptom: correlation ids stop appearing in
  search while the service itself stays healthy. This is external to the
  service. Recovery: verify the service is healthy (check Grafana dashboards),
  then escalate to the logging platform team. No action needed on the ledger
  API itself.

## Recovery

Roll back:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Restart a single pod (Kubernetes will automatically create a replacement):

```bash
kubectl --context production delete pod -l app=ledger-api
```

This will terminate all running ledger-api pods. Kubernetes automatically
recreates them. Wait ~30 seconds for the new pods to be ready.

**Caution on rollback:** Rolling back does not delete or fix data written by
the newer image. Entries written by the newer version will have `amount_minor`
values that the older image may interpret differently. This is a known data
inconsistency issue. Before rolling back, coordinate with the platform team
on data impact.
