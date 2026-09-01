# Ledger API operations

## Signals

The readiness endpoint is `GET /healthz` and should return HTTP 200 with
`{"status":"ok"}`. Application events should be emitted as structured JSON
with a request correlation ID to the platform log sink. Fee releases also emit
the invoice ID, old/new fee, currency minor unit, and release image digest;
never log payment credentials. The exact sink and correlation-ID field are
deployment-specific and must be confirmed by SRE.

## Alerts

Page the release owner immediately on any non-zero fee delta in the canary,
processor reconciliation mismatch, or error/latency gate breach. First action:
halt traffic promotion and run the documented rollback. Finance/SRE still need
to set numeric error, latency, and fee-delta thresholds before release.

## Failure modes

- Rounding-rule mismatch: invoices and charges succeed, but next-morning
  processor reconciliation reports a fee delta. Stop promotion and roll back.
- Bad image or configuration: readiness, error rate, or latency degrades after
  deployment. Halt rollout and roll back.
- Processor/reconciliation delay: the canary has no comparison yet. Treat the
  release as unobserved; do not promote to 100% until the cycle completes.

## Recovery

Run the release rollback command in `RELEASE.md`. It restores the prior image,
but does not undo invoices or charges already written; identify affected
invoice IDs from the release window and have Finance handle corrections.
Restarting pods is not a fee correction. Database rollback is not required:
this release has no schema migration.
