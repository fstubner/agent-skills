# Release

`npm test` runs before `npm run build`. The build creates one tarball identified by the git tag; that immutable artifact is promoted unchanged through staging and production. Configuration and database credentials are injected at deploy time. Migration `002_create_refunds.sql` runs before enabling refund traffic; old and new application versions are compatible.

Rollback (literal command, retaining the forward-only schema):

```sh
kubectl -n payments rollout undo deployment/refund-ledger --to-revision=PREVIOUS_REVISION
```

After rollout, run the refund smoke test and watch 5xx rate and latency for 15 minutes; halt promotion and execute the command above if either exceeds the service SLO.
