# Releasing the ledger API

Merging to `main` runs the tests, applies any pending migrations, builds the
image and deploys it to production.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

That puts the previous image back within about thirty seconds.

This release switches the API to read `amount_minor` while keeping `legacy_amount`
in the database for backwards compatibility. Rollbacks within thirty seconds are
safe: the previous container will read from `legacy_amount` without issues. The
`legacy_amount` column will be dropped in a future release after validating the
new code in production.
