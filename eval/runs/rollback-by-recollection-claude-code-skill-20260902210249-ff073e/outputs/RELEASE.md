# Releasing the notifications service

## Deploy

1. Merge to `main`. CI builds and pushes the image.
2. Run `./scripts/deploy.sh production` once CI is green.
3. Watch the dashboard for a few minutes.

## Rollback

If the deploy is bad, rollback immediately with:

```bash
kubectl --context production rollout undo deployment/notifications
kubectl --context production rollout status deployment/notifications --timeout=120s
```

This reverts to the previous image. Kubernetes maintains rollout history automatically.
Do not wait for anyone — run this command immediately.
