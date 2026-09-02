# Operations

## Signals

GET `/health` returns 200 with `{status: "ok"}` when the service is ready.
Structured JSON logs to stdout (via Express); every request carries a unique correlation id via `X-Request-Id` header when provided.

## Alerts

Error rate spike (5xx responses > 5% for 5 minutes) → page on-call → check `GET /health`, then roll back per Recovery below.
Latency spike (p95 > 500ms for 5 minutes) → ticket to backend team, investigate query performance.

## Failure modes

Database connection lost → health check passes but `/entries/:id` returns errors. Symptom: 200 on `/health`, 5xx on entry requests.
Service OOM → rapid 502s from Kubernetes, health check times out. Symptom: curl timeout on `/health`.
Corrupted ledger data → health check passes but entry amounts are incorrect. Detected by integration tests, not by health endpoint.

## Recovery

Roll back: `kubectl rollout undo deploy/ledger-api --context production` — fast and safe, restores previous image and data is unmodified.
Restart pod: `kubectl rollout restart deploy/ledger-api --context production` — forces a new pod, clears in-memory state, no data loss.
