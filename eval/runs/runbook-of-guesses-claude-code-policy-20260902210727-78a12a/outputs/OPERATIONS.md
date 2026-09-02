# Operating the ledger API

Double-entry ledger read API. The service serves entry amounts from the database 
using a reconciliation cursor to ensure consistency with the reporting export.

## Signals

Dashboards live in the `ledger` folder in Grafana. The service emits structured
JSON logs with `correlationId`, `entries.read.duration_ms`, and `entries.read.errors`,
but these logs are not consumed by any pipeline and should not be used for diagnosis.

Current metrics to monitor:
- p99 latency (target: <800ms; baseline unknown, service has never run above ~20 rps)
- Error rate (target: <2%)
- Active database connections

## Alerts

- **Error rate above 2%** over five minutes: Check recent deploys (last 15 min).
  If a deploy went out, roll back. If no recent deploy, check the database connection.
- **Stale reconciliation cursor** (real failure mode): Queried via `/health` endpoint
  or by comparing `/entries/:id` amount against the reporting export for recent entries.

## Failure modes

**Stale reconciliation cursor** (known, happened twice; most recent 4 Aug).
  - Symptom: `/entries/:id` returns amounts that disagree with the reporting export
    for entries written in the last hour. Indicates the reconciliation job fell behind.
  - **Recovery**: SSH to a pod and restart the reconciliation job (procedure TBD with platform team).
  - **Verify**: Requery `/entries/:id` for a recent entry and confirm amount matches
    the reporting export.

## Recovery procedures

**Rollback the deployment:**

```bash
kubectl --context production rollout undo deployment/ledger-api
```

After rollback, verify:

```bash
kubectl --context production rollout status deployment/ledger-api
```

**If error rate does not drop after rollback:** Escalate to the ledger service owner.
The older code version is running; this indicates a database or infrastructure issue,
not a code regression.

**Note on data during rollback:** Entries written by a newer image keep their internal
state intact; the older image serves them correctly. No data is lost.
