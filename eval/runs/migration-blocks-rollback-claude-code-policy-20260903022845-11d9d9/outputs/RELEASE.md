# Releasing the ledger API

Merging to `main` runs the tests, applies any pending migrations, builds the
image and deploys it to production.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

That puts the previous image back within about thirty seconds.

### Why this is safe

This release adds the `amount_minor` column to the database but keeps the `legacy_amount` column intact. The previous API version reads from `legacy_amount`, so if a rollback is needed:

1. The deployment reverts to the previous image (which reads `legacy_amount`)
2. The database schema remains unchanged (both columns present)
3. The old API continues working immediately

The `legacy_amount` column is dropped in a later release, only after `amount_minor` has been validated in production.
