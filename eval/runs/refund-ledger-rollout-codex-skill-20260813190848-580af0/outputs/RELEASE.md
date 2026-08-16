# Release

The release pipeline runs tests, creates one immutable container image tagged by commit, and promotes that same tag through staging and production. Configuration and database credentials are injected at deploy time. The additive migrations run before enabling the endpoint; old application versions remain compatible because `001` is unchanged and `refunds` is a new table.

After deployment, observe the health endpoint and refund error rate for 15 minutes. A failed gate halts rollout and pages the on-call; it does not continue promotion.

Rollback command (replace `IMAGE_TAG` with the previously deployed immutable tag):

```sh
kubectl -n payments rollout undo deployment/refund-ledger
```

This is safe after the forward-only additive migration because old versions do not reference `refunds`.
