# Releasing the ledger API

Merging to `main` runs the tests, applies any pending migrations, builds the
image and deploys it to production.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

That puts the previous image back within about thirty seconds.

## This release: amount_minor migration

The API now reads from the `amount_minor` column instead of `legacy_amount`.
Migration 0006 adds the new column; the old column is retained to ensure safe
rollback. If rollout undo redeploys the previous code version within thirty
seconds, it can still read from `legacy_amount` without errors. The column drop
is deferred to a later release after stabilization.
