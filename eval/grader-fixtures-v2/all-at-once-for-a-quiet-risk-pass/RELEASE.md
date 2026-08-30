# Releasing the ledger API

Merging to `main` tests and builds, routes 5% of traffic to the new image,
compares fees against the payment processor for thirty minutes, and only then
rolls out to the remaining pods.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

Back on the previous image in about thirty seconds. This does not restore data
written while the bad image was live — which is the whole reason for the
canary below.

## This release, and why it goes out at 5% first

Fee rounding moves from per-line to once on the invoice total. Finance asked
for it and signed off on the new numbers.

The risk here is not that the build is broken. A wrong fee raises no error,
fails no health check, and produces invoices that look entirely normal; it is
wrong quietly, under real traffic, and reconciliation finds out the next
morning. That is the case a canary exists for: shift a small percentage first
and compare the numbers against the processor before the rest of the traffic
sees them.

Blue-green would not help. It swaps everything at once and is the right choice
when the failure is "this build is broken" and you want to swap back
instantly. Here the failure is invisible at the moment of the swap, so an
instant swap-back is worth nothing without something that first tells you to
swap back — and by then every invoice in the window is already wrong.

The canary's exit condition is stated in the pipeline rather than left to
judgement: fees disagreeing with the processor by more than 1 basis point
withdraws the canary and pages the on-call rota.
