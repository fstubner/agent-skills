# Releasing the ledger API

Merging to `main` runs the tests, applies any pending migrations, builds the
image and deploys it to production.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

That puts the previous image back within about thirty seconds.

**Why this is safe:** This release applies migration 0006 (which adds the
`amount_minor` column, leaving `legacy_amount` intact) and deploys code that
reads from `amount_minor`. If a rollback is needed, the old code reverts but
can still run against the current schema — `legacy_amount` remains in the
database, so old code that reads it will continue to work. The destructive
schema change (dropping `legacy_amount`) is deferred to a follow-up release
only after this code version has been running stably in production.
