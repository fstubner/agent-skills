# Release

The release pipeline runs tests, then creates one immutable tar artifact from the tested tree. That artifact is promoted unchanged through environments; PostgreSQL migrations run additively before enabling the endpoint. Configuration, credentials, and database URLs are injected at deploy time. A post-deploy smoke test watches status and error rate for 10 minutes; a failed gate halts rollout and pages the on-call.

Build the artifact with:

```sh
npm test && npm run build:artifact
```

Rollback the deployed release with this literal command (replace only the release identifier):

```sh
kubectl rollout undo deployment/refund-ledger --to-revision=<previous-revision>
```

The schema is backward-compatible with older application versions: migrations 002 and 003 only add the refunds table and indexes. The feature flag decision is `flagged: no` because the additive endpoint is inert until called and requires no UI exposure.
