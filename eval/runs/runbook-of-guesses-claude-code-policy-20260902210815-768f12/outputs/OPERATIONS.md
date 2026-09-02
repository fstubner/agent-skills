# Operating the ledger API

## Known issues and recovery

### Stale reconciliation cursor (real)
**Symptom:** `/entries/:id` returns amounts that disagree with the reporting
export for entries written in the last hour.

**Cause:** The reconciliation job has fallen behind processing entries.

**Recovery:**
1. Run `kubectl exec -it <pod-name> -- kill-9 <reconciliation-pid>` to kill the stale job
2. Restart the pod: `kubectl delete pod -l app=ledger-api`
3. The reconciliation job will restart and catch up within 5–10 minutes
4. Verify by fetching the same entry again; amounts should match reporting export

**Contact:** @platform-team if the problem persists after restart

## Unknown/unlikely issues

The following were documented as risks but do not apply to this service:

- **Database connection pool exhaustion.** This happened to a different service
  on the same database. The ledger-api does not use connection pooling.
- **Log pipeline backpressure.** The central log pipeline was decommissioned
  in June. The service still emits logs locally but they are not shipped.

## Alerts (experimental)

These alert thresholds have not been validated under production load. The
service has only been tested up to ~20 req/s. If you are paged:

- **p99 latency >800ms:** Check recent deploys via `kubectl rollout history`.
  If a deploy went out in the last 15 minutes, try rolling back:
  ```bash
  kubectl --context production rollout undo deployment/ledger-api
  ```
  Otherwise contact @platform-team.

- **Error rate >2%:** Check pod logs: `kubectl logs -l app=ledger-api`.
  If errors started after a deploy, roll back as above. Otherwise contact
  @platform-team.

**Escalation:** If rolling back doesn't resolve the alert within 5 minutes,
contact @platform-team immediately.
