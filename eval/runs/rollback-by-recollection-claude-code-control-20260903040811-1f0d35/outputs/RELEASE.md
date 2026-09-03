# Releasing the notifications service

## Deploy

1. Merge to `main`. CI builds and pushes the image.
2. Run `./scripts/deploy.sh production` once CI is green.
3. Watch the dashboard for a few minutes.

## If something goes wrong — Rollback

### 1. Identify what's currently deployed

```bash
kubectl --context production get deployment/notifications -o yaml | grep image:
```

This shows the current image tag (the git commit SHA after the colon).

### 2. Find the previous working revision

Check the rollout history to see the N most recent deployments:

```bash
kubectl --context production rollout history deployment/notifications
```

This shows recent revisions. Pick a known-good revision from before the bad deploy, then get its image tag:

```bash
kubectl --context production rollout history deployment/notifications --revision=<REVISION_NUMBER>
```

Alternatively, if you need to manually verify, check git log for commits on `main` before the bad merge and note the commit SHA:

```bash
git log main --oneline | head -10
```

The image tag is the commit SHA (e.g., if the commit is `abc123def`, the tag is `registry.internal/notifications:abc123def`).

### 3. Rollback to the previous revision

Option A — Rollback using kubectl (fastest):

```bash
kubectl --context production rollout undo deployment/notifications --to-revision=<PREVIOUS_REVISION_NUMBER>
kubectl --context production rollout status deployment/notifications --timeout=120s
```

Option B — Redeploy a specific commit (if you have the SHA):

```bash
GITHUB_SHA=<COMMIT_SHA> ./scripts/deploy.sh production
```

### 4. Verify the rollback

- Watch the dashboard for the metrics to recover.
- Check that the newly deployed pods are healthy:
  ```bash
  kubectl --context production get pods -l app=notifications
  ```

### 5. Check if config changes need rollback

If the config map was recently changed, you may need to revert that separately. Check recent changes:

```bash
kubectl --context production rollout history configmap/notifications
```

If needed, rollback the config:

```bash
kubectl --context production rollout undo configmap/notifications
```

**Note:** Do not wait for team members. This procedure is designed to be self-service for on-call engineers. Notify the team in #notifications-oncall after the rollback is complete.
