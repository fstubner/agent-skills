# Releasing the ledger API

Merging to `main` runs the checks below. The image is built once, then the
same image digest is promoted through staging and production; environment
configuration and secrets are injected by the deployment system, never baked
into the image.

## Rollout decision

This is a canary release because the failure mode is a plausible, silent
financial discrepancy under real invoice traffic. Deploy the image to staging,
run invoice fixtures including values that sit on rounding boundaries, and
observe reconciliation against the processor sandbox. Then send 5% of
production invoice traffic to the new image for one reconciliation cycle,
followed by 25%, 50%, and 100% only if the fee-delta metric remains zero and
invoice/charge error rates and latency remain within baseline for the defined
observation window.

The rollout is halted and the rollback command below is run automatically if
the fee-delta metric is non-zero, reconciliation reports a mismatch, or the
error/latency gates breach their production thresholds. The exact thresholds
must be supplied by Finance/SRE before approval; they are not yet recorded in
this repository.

`flagged: no — the fee calculation is a pure library change with no existing
runtime flag/config seam. Canary traffic and reconciliation gates provide the
behavior-release control; add a flag before rollout if the service gains a
runtime fee-calculation switch.`

## Pipeline gates

1. Lint/static checks and unit tests.
2. Build and publish one immutable image digest.
3. Deploy that digest to staging and run boundary-value invoice tests.
4. Canary the same digest in production with fee-delta and service-health
   gates.
5. Promote traffic progressively, then observe the completed rollout for one
   full reconciliation cycle. A successful deploy command alone is not a
   release.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live.

## This release

Fee rounding moves from per-line to once on the invoice total. Finance asked
for it and signed off on the new numbers. The calculation is intentionally
kept in `src/pricing.js`; rollback restores the previous image and therefore
the previous fee behavior. No schema migration is included.
