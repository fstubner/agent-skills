# Releasing the ledger API

Merging to `main` runs the tests, applies any pending migrations, builds the
image and deploys it to production.

This release switches the API to read from the `amount_minor` column. The
`legacy_amount` column is retained for backward compatibility: if rollout undo
restores the previous image (old code), that code will still be able to read
data without errors.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

That puts the previous image back within about thirty seconds. Since the schema
keeps `legacy_amount`, old code and new code can both run against the same
schema — the old code reads what it expects, and the new code reads the new
column. The `legacy_amount` column will be dropped in a follow-up release after
confirming stability.
