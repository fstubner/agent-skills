# Operating the ledger API

## Signals

The service emits structured JSON logs with a `correlationId` on every
request, plus `entries.read.duration_ms` and `entries.read.errors` as counters.
Logs ship to the central log pipeline and are searchable by correlation id.

Dashboards live in the `ledger` folder in Grafana.

## Alerts

- p99 latency above 800ms for five minutes pages the on-call engineer. First
  response: check the database connection pool saturation panel. If pooled
  connections are >80% full, this is likely a slow query hold — see
  "Database connection pool exhaustion" in Failure modes.
- Error rate above 2% of requests over a five-minute window pages the on-call
  engineer. First response: check whether a deploy went out in the last
  fifteen minutes. If yes, roll back immediately using the command in Recovery.
  If no, check Grafana's `ledger/Error Rate` dashboard for which endpoint is
  failing.
- Connection pool exhaustion (all 20 connections busy for 60 seconds) pages
  the on-call engineer. First response: if latency is climbing, restart a
  single pod (see Recovery section). If latency is flat, a client may be
  holding connections; check recent deployments in the last 15 minutes.

## Failure modes

- **Database connection pool exhaustion.** Symptom: requests queue and p99
  climbs sharply while error rate stays flat, then requests start timing out
  at 30 seconds. Caused by a slow query holding connections. First response:
  check Grafana's `ledger/Connection Pool` panel. If a deploy went out in the
  last 15 minutes, rollback. Otherwise, restart a pod. If the problem recurs
  immediately, the pool may be legitimately saturated under current load —
  escalate to the database team.
- **Stale reconciliation cursor.** Symptom: `/entries/:id` returns amounts
  that disagree with the reporting export for entries written in the last
  hour. Caused by the reconciliation job falling behind. First response:
  check the `ledger/Reconciliation Lag` dashboard. If lag is growing, this
  requires investigation — do not rollback, as the issue likely predates the
  current deployment. Page the on-call database team.
- **Log pipeline backpressure.** Symptom: correlation ids stop appearing in
  search while the service itself stays healthy (latency and error rate
  normal). Caused by the central logging pipeline being overloaded. First
  response: this is an infrastructure issue, not a ledger-api issue. Escalate
  to the platform team; the service is healthy.

## Recovery

### Rollback

Use this if a bad deploy shipped in the last 15 minutes. This reverts to the
previous image; no data is lost or restored. Entries written by the new image
stay in the database with their current `amount_minor` values — the older image
can read and serve them correctly, so data consistency is preserved.

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Check the rollout status:

```bash
kubectl --context production rollout status deployment/ledger-api
```

### Restart a single pod

Use this if one pod is consuming all available connections or is otherwise
unhealthy. This does not affect entries in the database.

```bash
kubectl --context production delete pod -l app=ledger-api --field-selector status.phase=Running
```

### Data risk summary

- Rollback is safe: the old image handles entries written by the new image.
- Restart is safe: no data is lost, only in-flight requests on that pod are
  dropped.
- Neither operation recovers data from the newer image; they only change which
  version serves it.
