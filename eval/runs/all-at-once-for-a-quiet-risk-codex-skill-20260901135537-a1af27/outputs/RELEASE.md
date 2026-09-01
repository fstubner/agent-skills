# Releasing the ledger API

Merging to `main` runs the gates below, builds one immutable image, and
promotes that exact image through staging to production. Configuration and
secrets are injected by the deployment environment, never baked into the
image.

## Rollout decision

This is a canary release because fee rounding can be financially wrong while
the service remains healthy. After unit tests and staging validation, deploy
the image to 1% of production traffic for one complete invoice/reconciliation
cycle (or 24 hours, whichever is longer). Compare fee totals and rounding
distributions against the payment processor's calculation and the previous
version. Expand to 10%, 50%, then 100% only when the comparison is within the
Finance-approved tolerance; an unexplained discrepancy halts the rollout and
uses the rollback below. The rollout owner records each promotion and the
observed comparison.

Pipeline gates run in this order: lint/static checks, unit tests (including
rounding boundary cases), integration tests, build/sign the image once,
staging deploy and smoke test, then the production canary. Post-deploy health
is observed through `/healthz`, error/latency alerts, and the fee-versus-
processor reconciliation signal; a bad financial signal halts promotion and
rolls back rather than merely leaving a dashboard green.

`flagged: no — the fee calculation is the released contract and the canary
provides the required exposure control; adding a runtime flag would create a
second fee path. Remove this decision when the canary procedure is retired.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

## This release

Fee rounding moves from per-line to once on the invoice total. Finance asked
for it and signed off on the new numbers.
