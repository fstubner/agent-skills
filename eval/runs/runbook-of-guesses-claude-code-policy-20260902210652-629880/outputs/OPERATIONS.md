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

## Failure modes and recovery

- **Database connection pool exhaustion.** Symptom: requests queue and p99
  climbs sharply while error rate stays flat, then requests start timing out
  at 30 seconds. Caused by a slow query holding connections. Recovery:
  1. Check the database connection pool saturation panel in Grafana.
  2. Query the database slow query log: `SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;`
  3. Kill the blocking query if one exists: `KILL <query_id>;`
  4. If killing the query doesn't recover, roll back (see below).

- **Stale reconciliation cursor.** Symptom: `/entries/:id` returns amounts
  that disagree with the reporting export for entries written in the last
  hour. Caused by the reconciliation job falling behind. Recovery:
  1. Check reconciliation status in Grafana (ledger folder, "Reconciliation" dashboard).
  2. If paused, restart the job: `kubectl --context production exec -it deployment/ledger-api -- /app/trigger-reconciliation`
  3. Monitor the reconciliation lag metric until it clears.

- **Log pipeline backpressure.** Symptom: correlation ids stop appearing in
  search while the service itself stays healthy. This is a downstream issue
  in the central log pipeline, not a ledger-api problem. Recovery: escalate
  to the logging team via Slack #platform-oncall. The service is healthy and
  requires no action.

## Recovery procedures

**Roll back a deploy:**

```bash
kubectl --context production rollout undo deployment/ledger-api
```

After rollback, monitor the error rate and latency dashboards for 5 minutes to confirm recovery. Entries written by the previous image version remain in the database and the rolled-back image will serve them correctly.

**Restart a single pod (if needed):**

```bash
# List pods to find the one to restart
kubectl --context production get pods -l app=ledger-api

# Delete the specific pod
kubectl --context production delete pod <pod-name> -n production
```

**Escalation:** If the above steps do not resolve the alert within 10 minutes, page the platform lead via PagerDuty and provide the correlation id and dashboard URL.
