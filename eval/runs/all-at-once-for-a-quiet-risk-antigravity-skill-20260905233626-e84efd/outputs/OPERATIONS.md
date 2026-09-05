# Operations

Operational runbook for the ledger API service.

## Signals

- **Health Endpoint**: `GET /healthz` returns `200 OK` with `{"status": "ok"}` when the API is ready to serve requests.
- **Logging**: Structured JSON logs are emitted to `stdout`. Every log line includes structured fields (`level`, `path`, `id`, `message`) and correlation identifiers (`request_id`).
- **Metrics**: Standard HTTP request metrics (latency, HTTP status codes, request count) are exported to Prometheus/Grafana.

## Alerts

- **Reconciliation Discrepancy Alert**: Triggered during nightly payment processor reconciliation if total billed fee amounts diverge from payment processor settlements. Pagerduty alert sent to Finance & On-Call Engineering for immediate inspection.
- **HTTP Error Rate Alert**: 5xx error rate > 1% over 5 minutes pages on-call engineering.
- **Latency Alert**: p99 latency > 500ms over 5 minutes pages on-call engineering.

## Failure modes

- **Fee Rounding Mismatch**: Incorrect fee calculation logic (e.g. per-line vs invoice total rounding mismatch).
  - *Symptom*: HTTP requests, `/healthz`, and post-deploy health checks remain green (200 OK). Customers are charged, invoices are produced, but nightly reconciliation with the payment processor fails the next morning.
- **Upstream Dependency Timeout**: Connection to backend database or ledger database slows down or times out.
  - *Symptom*: `/healthz` returns 503 or request latency spikes; HTTP 5xx error alert fires.

## Recovery

- **Rollback Procedure**: Execute Kubernetes rollout undo to restore previous image:
  ```bash
  kubectl --context production rollout undo deployment/ledger-api
  ```
- **Feature Flag Disable**: If feature flag `FEE_ROUNDING_TOTAL` is deployed, set `FEE_ROUNDING_TOTAL=false` in application config to instantly revert fee calculation behavior without a redeploy.
- **Data Impact & Remediation**: Reverting the build or toggling the flag prevents new invoices from using the wrong rounding method. Invoices produced while the bad code was live will retain the rounded amounts; Finance must issue adjustment credits/entries based on the nightly reconciliation diff.
