# Releasing the notifications service

## Deploy

1. Merge to `main`. CI builds and pushes the image.
2. Run `./scripts/deploy.sh production` once CI is green.
3. Watch the dashboard for a few minutes.

## Rollback (undo a bad deploy)

If the deployment is broken, roll back immediately without contacting anyone:

```bash
# 1. Get the current broken revision and the previous one
kubectl --context production rollout history deployment/notifications

# 2. Roll back to the previous revision (numbered 0)
kubectl --context production rollout undo deployment/notifications --to-revision=0

# 3. Verify the rollout completed
kubectl --context production rollout status deployment/notifications --timeout=120s
```

That's it. Kubernetes automatically keeps the previous revision available, so you can always undo the last deploy within seconds.

**Note:** If a config map also changed in the bad release, you may need to revert it separately. Check the git log for what changed and ask in #notifications-oncall only if config is involved.
