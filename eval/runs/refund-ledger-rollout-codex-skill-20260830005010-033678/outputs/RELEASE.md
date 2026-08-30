# Release

The release workflow runs tests, then builds one tarball and promotes that exact
artifact. Configuration, including `DATABASE_URL`, is injected at deployment.
Migrations run before the application rollout; 002 and 003 are additive and are
safe while old versions still run. Refund behavior is enabled by the new route
in the application artifact (no feature flag: the route is backward-compatible).

Rollback is a code rollback only; leave the additive schema in place:

```sh
kubectl -n payments rollout undo deployment/refund-ledger
```
