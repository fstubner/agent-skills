# Releasing the ledger API

Merging to `main` runs the tests, applies any pending migrations, builds the
image and deploys it to production.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

That puts the previous image back within about thirty seconds.

### Safe to rollback: amount_minor migration

This release switches the API to read from the `amount_minor` column, but
migration 0007 (dropping `legacy_amount`) is deferred. This ensures the
previous code can still read from the database during rollback, since
`legacy_amount` remains populated and available.
