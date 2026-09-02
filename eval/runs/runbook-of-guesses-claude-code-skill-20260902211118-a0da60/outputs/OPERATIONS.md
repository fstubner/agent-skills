# Operating the ledger API

## Signals

The service emits structured JSON logs with a `correlationId` on every
request, plus `entries.read.duration_ms` and `entries.read.errors` as counters.
Logs ship to the central log pipeline and are searchable by correlation id.

Dashboards live in the `ledger` folder in Grafana.

## Alerts

- p99 latency above 800ms for five minutes pages the on-call engineer. First
  response: check the database connection pool saturation panel. If saturated
  (>90% in use), check for slow queries with `kubectl logs -l app=ledger-api
  --tail=100 | grep "duration_ms"` — look for queries >5 seconds. If found,
  investigate the query against the schema. If latency persists after 5
  minutes, restart all pods: `kubectl --context production rollout restart
  deployment/ledger-api`.
- Error rate above 2% of requests over a five-minute window pages the on-call
  engineer. First response: check whether a deploy went out in the last
  fifteen minutes with `kubectl --context production rollout history
  deployment/ledger-api`. If a deploy is recent (within 15 min), check the
  most recent pod logs for errors. If errors are deployment-related (e.g.
  missing config, new code errors), execute the rollback procedure below. If
  error rate returns to <1% within 5 minutes on its own, investigate the
  cause post-incident.
- Connection pool exhaustion (all 20 connections busy for 60 seconds) pages
  the on-call engineer. Immediate action: restart the deployment to clear
  any leaked connections: `kubectl --context production rollout restart
  deployment/ledger-api`.

## Failure modes

- **Database connection pool exhaustion.** Symptom: requests queue and p99
  climbs sharply while error rate stays flat, then requests start timing out
  at 30 seconds. Caused by a slow query holding connections. Recovery: restart
  the deployment (see Alerts section above for latency alert response). If
  problem recurs within 10 minutes, collect slow query logs and escalate to
  the database team.
- **Stale reconciliation cursor.** Symptom: `/entries/:id` returns amounts
  that disagree with the reporting export for entries written in the last
  hour. Caused by the reconciliation job falling behind. Recovery: restart the
  reconciliation job with `kubectl --context production delete pod -l
  app=ledger-reconciler`. Job will resume from its saved cursor position and
  catch up. This may take 10-30 minutes depending on backlog. If not caught
  up after 1 hour, check job logs with `kubectl logs -l app=ledger-reconciler
  --tail=50` and escalate to the data team if errors are present.
- **Log pipeline backpressure.** Symptom: correlation ids stop appearing in
  search while the service itself stays healthy. Recovery: this indicates a
  problem in the central logging platform, not this service. Check the status
  page of the logging service. If logging service is healthy, the issue is
  network connectivity. Restart pods to force log replay: `kubectl --context
  production rollout restart deployment/ledger-api`. Escalate to the platform
  team if logs remain unavailable.

## Recovery

**Rollback procedure** (use only after a bad deploy):

1. View deployment history: `kubectl --context production rollout history
   deployment/ledger-api`
2. Find the stable revision (usually the one before the most recent). If
   unsure, ask in #oncall-ledger for the last known good version.
3. Rollback to a specific revision (e.g., revision 42):
   ```bash
   kubectl --context production rollout undo deployment/ledger-api --to-revision=42
   ```
4. Verify the rollout is complete: `kubectl --context production rollout
   status deployment/ledger-api`
5. Check error rate and latency drop within 2 minutes. If not, rollback
   again to an earlier revision.

**Important data note:** Entries written by the newer image include new fields
the older image does not understand. After rollback, `/entries/:id` queries
will still return correct `amount_minor` values for all entries (old and new),
but new fields from recent writes will be omitted. This is safe and queries
remain consistent. Do not worry about data corruption.

**Restart a single pod** (for log replay or cache clear without full rollback):

```bash
kubectl --context production delete pod -l app=ledger-api --field-selector status.phase=Running
```

The deployment will automatically spawn a replacement. Use this for
transient issues like log backpressure or suspected memory leaks.
