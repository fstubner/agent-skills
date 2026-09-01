# Operations

## Signals

`GET /healthz` returns HTTP 200 and `{ "status": "ok" }`. HTTP requests emit
newline-delimited structured JSON to stdout with `event`, `request_id`, method,
path, and status; the platform collector forwards stdout to the production log
store. The fee canary dashboard must also show invoice fee totals by release
digest. The exact dashboard and log-store names are not yet recorded here.

## Alerts

Page the on-call if HTTP 5xx exceeds 2% for 5 minutes, p95 latency exceeds the
service SLO for 10 minutes, or `/healthz` fails three checks in five minutes;
first check the endpoint and release digest, then halt the canary and roll back.
Page Finance/Payments immediately on any processor reconciliation mismatch or
fee-total discrepancy, even when health and charge success remain green.
Alert thresholds are provisional until production baselines are measured.

## Failure modes

Per-line versus invoice-total rounding disagreement produces valid invoices and
successful charges while next-morning processor reconciliation differs; inspect
fee totals by release digest first. A bad image can leave `/healthz` green while
fees are wrong. Processor timeouts show as elevated charge errors and may leave
retries pending; inspect structured request logs and idempotency records.

## Recovery

Roll back with:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

This restores the prior image and does not undo invoices or charges already
written. Preserve those records, stop further rollout, and coordinate Finance
and Payments on correction/reconciliation. For an unhealthy pod, restart via
`kubectl --context production rollout restart deployment/ledger-api`; in-flight
requests may be retried, so duplicate-charge risk must be checked.
