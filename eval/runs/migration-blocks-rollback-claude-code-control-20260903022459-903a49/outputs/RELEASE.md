# Releasing the ledger API

Merging to `main` runs the tests, applies any pending migrations, builds the
image and deploys it to production.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

That puts the previous image back within about thirty seconds.

## Why we keep `legacy_amount` in the database

This release switches the API to read `amount_minor` instead of `legacy_amount`.
We do NOT drop the `legacy_amount` column in this release. This allows safe
rollback: if the deployment of the new image fails and we undo the rollout, the
old container image can still read `legacy_amount` from the database and
continue serving requests. The column will be dropped in a future release, only
after we're confident the new code is stable.
