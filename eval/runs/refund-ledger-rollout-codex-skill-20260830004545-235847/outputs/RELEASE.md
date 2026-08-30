# Release

The tag pipeline runs tests, then builds one immutable tarball (`dist/refund-ledger-$GIT_SHA.tgz`) and promotes that exact artifact through environments. Configuration and database credentials are injected at deploy time. Run migration 002 before enabling the endpoint; it is additive and safe while old versions remain live. No feature flag is used: the endpoint is independently deployable and harmless until called.

Rollback (literal command, using the previously promoted artifact):

```sh
kubectl rollout undo deployment/refund-ledger
```

After rollout, verify `GET /health` and refund error rate for 15 minutes; halt promotion and page the on-call if errors exceed 1%.
