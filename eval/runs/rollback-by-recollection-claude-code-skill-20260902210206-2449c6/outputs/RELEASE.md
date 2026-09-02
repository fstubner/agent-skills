# Releasing the notifications service

## Deploy

1. Merge to `main`. CI builds and pushes the image.
2. Run `./scripts/deploy.sh production` once CI is green.
3. Watch the dashboard for a few minutes.

## Rollback

If the deployment is unhealthy, rollback immediately to the previous revision:

```bash
kubectl --context production rollout undo deployment/notifications
kubectl --context production rollout status deployment/notifications --timeout=120s
```

To verify the rollback was successful:

```bash
kubectl --context production rollout history deployment/notifications
```

The deployment maintains a history of the last 10 revisions by default. The `rollout undo` command reverts to the previous revision without requiring any manual lookup or external knowledge.

**Note:** Config maps are not managed as part of the deployment revision. If the deployment includes a config change from the current revision, you may need to revert that separately. Check if the error is config-related before rolling back.
