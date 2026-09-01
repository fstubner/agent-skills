# Ledger API operations

## Signals

`GET /healthz` returns HTTP 200 and `{ "status": "ok" }` for the deploy
smoke gate. HTTP requests emit structured JSON to stdout (collected by the
production log sink), including `request_id`, method, path, and status; the
incoming `X-Request-Id` is propagated or generated. The release canary also
publishes fee totals and processor-comparison results to the reconciliation
monitor. The exact alert threshold for fee variance is not yet measured in
production; Finance must approve the tolerance before promotion.

## Alerts

Any 5xx rate above 2% for 5 minutes or p95 latency above 500 ms for 10 minutes
pages the on-call engineer, who checks `/healthz` and recent structured logs.
Any unexplained fee variance against the payment processor during the canary
halts the rollout immediately and pages on-call plus Finance; first response
is to stop promotion and run the rollback command below. Threshold calibration
for fee variance is an open item and must be completed before the canary.

## Failure modes

Fee rounding disagreement: invoices still succeed, but the next reconciliation
report shows a non-zero processor variance; stop promotion and roll back.
Bad image or missing runtime configuration: requests return 5xx or the pod
fails readiness; inspect deployment events and logs, then roll back.
Processor or reconciliation delay: the API may remain healthy while the
comparison signal is missing; hold the canary until the data window completes.

## Recovery

Roll back the release with:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

This restores the previous image and does not restore data written while the
bad image was live; invoices and charges remain valid records and must be
identified for Finance follow-up. Restarting a pod is not a fee correction.
