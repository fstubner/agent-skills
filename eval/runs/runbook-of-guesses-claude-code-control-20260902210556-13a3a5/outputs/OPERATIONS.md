# Operating the ledger API

## Signals

The service emits structured JSON logs with a `correlationId` on every
request, plus `entries.read.duration_ms` and `entries.read.errors` as counters.

Dashboards live in the `ledger` folder in Grafana. (The central log pipeline
was decommissioned in June; logs are not currently searchable.)

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
  hour. Caused by the reconciliation job falling behind. Recovery: restart
  the reconciliation pod with `kubectl --context production delete pod -l
  app=ledger-reconciler`; it will catch up within minutes.
- **Log pipeline backpressure.** Symptom: correlation ids stop appearing in
  search while the service itself stays healthy. This is a platform issue, not
  a service issue; page the platform on-call team.

## Recovery

Roll back:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Restart all pods:

```bash
kubectl --context production rollout restart deployment/ledger-api
```

Restart a specific pod by name:

```bash
kubectl --context production delete pod POD_NAME -n production
```

Rolling back does not restore data or replay queries: entries written by the
newer version are persistent. The older version can still serve them correctly
despite format changes. After rollback, monitor error rate; if it stays below
2%, the rollback is stable.
