# Releasing the ledger API

Merging to `main` runs the tests, applies pending migrations as a separate
job, then builds and deploys the image.

## Rolling back

```bash
kubectl --context production rollout undo deployment/ledger-api
```

That puts the previous image back within about thirty seconds.

**This rollback is safe for this release, and here is why.** Migration 0007 is
additive: it backfills `amount_minor` and removes nothing. The previous image
reads `legacy_amount`, that column is still there, so rolling the code back
does not require rolling the schema back — which is the case where a rollback
stops being a thirty-second operation.

**What the rollback does not restore.** Rows written by the new code after the
deploy have `amount_minor` set and `legacy_amount` left at its old value. The
old image will serve the stale `legacy_amount` for those rows until the code
is rolled forward again. Reconciliation notices this; nothing is lost.

## The contraction, deliberately not in this release

Dropping `legacy_amount` and making `amount_minor` NOT NULL is a separate
release, and it can only go out once every running image reads `amount_minor`
— that is, once this release has been live long enough that rolling back to
the previous image is no longer something anyone would do. Until then, the
drop would make the rollback above unsafe without anyone noticing.
