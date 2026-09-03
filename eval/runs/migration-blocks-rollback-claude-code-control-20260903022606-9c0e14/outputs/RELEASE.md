# Releasing the ledger API

Merging to `main` runs the tests, applies any pending migrations, builds the
image and deploys it to production.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

That puts the previous image back within about thirty seconds.

This release is safe to roll back because it only adds the new `amount_minor` column
without dropping `legacy_amount`. The previous API code can still read from
`legacy_amount` if needed, and the new API code reads from `amount_minor`. Both
columns coexist in the database, so either API version works with the schema.
