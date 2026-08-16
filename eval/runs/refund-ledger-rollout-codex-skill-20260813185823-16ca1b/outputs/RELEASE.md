# Release

`npm run release` runs tests first and then creates the immutable `dist/` artifact. Promote that exact directory (or archive it with its commit SHA); do not rebuild per environment. Configuration and database credentials are injected at deploy time. Run a post-deploy smoke test and halt the rollout on failure.

Migrations are additive and must run before application rollout, so older versions remain compatible during the rolling deployment. No feature flag is needed: the endpoint is additive and can be disabled at the router if operationally required.

Literal rollback command (replace the image reference with the previously promoted immutable artifact):

```sh
kubectl -n payments rollout undo deployment/refund-ledger
```
