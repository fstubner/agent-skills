# Releasing the ledger API

Merging to `main` runs the tests, applies any pending migrations, builds the
image and deploys it to production.

## Rollback strategy

This release migrates the API from reading `legacy_amount` to reading the
`amount_minor` column. The rollback is safe within thirty seconds because:

- Migration `0006_add_amount_minor.sql` was applied in a previous release and
  added the `amount_minor` column (both columns coexist in the database).
- The new code reads `amount_minor`; the previous deployment's code reads
  `legacy_amount`.
- Both code versions work with the current schema until the `legacy_amount`
  column is dropped in a future release.

To rollback if the new deployment is unhealthy within thirty seconds:

```bash
kubectl --context production rollout undo deployment/ledger-api
```

This restores the previous image within about thirty seconds. The old code
continues to work because `legacy_amount` still exists in the schema.

Once this release is stable in production (at least 24 hours), the
`legacy_amount` column will be dropped in a follow-up release.
