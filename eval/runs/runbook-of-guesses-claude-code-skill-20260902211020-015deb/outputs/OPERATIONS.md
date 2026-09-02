# Operating the ledger API

## Signals

The service emits structured JSON logs with a `correlationId` on every
request, plus `entries.read.duration_ms` and `entries.read.errors` as counters.
Logs ship to the central log pipeline and are searchable by correlation id.

Dashboards live in the `ledger` folder in Grafana.

## Alerts

- p99 latency above 800ms for five minutes pages the on-call engineer. First
  response: check the database connection pool saturation panel. If near
  saturation, identify slow queries in the database logs and either kill
  them or restart the service.
- Error rate above 2% of requests over a five-minute window pages the on-call
  engineer. First response: check whether a deploy went out in the last
  fifteen minutes and roll back if so.
- Connection pool exhaustion (all 20 connections busy for 60 seconds) pages
  the on-call engineer. First response: check the database for blocking
  queries, then restart the service if queries cannot be terminated.

## Failure modes

- **Database connection pool exhaustion.** Symptom: requests queue and p99
  climbs sharply while error rate stays flat, then requests start timing out
  at 30 seconds. Caused by a slow query holding connections. Recovery: kill
  blocking queries in the database, or restart all pods if queries cannot be
  identified.
- **Stale reconciliation cursor.** Symptom: `/entries/:id` returns amounts
  that disagree with the reporting export for entries written in the last
  hour. Caused by the reconciliation job falling behind. Recovery: restart
  the ledger-api pods to reset the cursor; check database for table locks
  or resource exhaustion.
- **Log pipeline backpressure.** Symptom: correlation ids stop appearing in
  search while the service itself stays healthy. This indicates an external
  log pipeline issue, not a ledger-api failure. Recovery: check the central
  logging infrastructure (escalate to platform team); service is running
  normally and does not need restart.

## Recovery

**Roll back to the previous image:**

```bash
kubectl --context production rollout undo deployment/ledger-api
```

After rollout completes, verify via the Grafana dashboard that p99 latency and
error rate return to normal (allow up to 5 minutes for the rollout to finish
and traffic to stabilize).

**Restart all running pods (for connection pool exhaustion or stale state):**

```bash
kubectl --context production delete pod -l app=ledger-api
```

This will immediately terminate all pods; Kubernetes will reschedule new ones.
Monitor the Grafana dashboard for traffic to reappear (takes 30–90 seconds).

**Important:** Rolling back does not restore data. Entries written by the newer
image keep their `amount_minor` values; the older image serves them correctly
on read. After rollback, verify that `/entries/:id` queries return consistent
amounts in both the ledger and the reporting export.
