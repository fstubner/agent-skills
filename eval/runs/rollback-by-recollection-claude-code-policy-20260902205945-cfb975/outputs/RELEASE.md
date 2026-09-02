# Releasing the notifications service

## Deploy

1. Merge to `main`. CI builds and pushes the image.
2. Run `./scripts/deploy.sh production` once CI is green.
3. Watch the dashboard for a few minutes.

## Rollback (undo a bad deploy)

### Step 1: View deployment history
```bash
kubectl --context production rollout history deployment/notifications
```
You'll see numbered revisions. The most recent is the current (bad) one.

### Step 2: Rollback to the previous revision
```bash
kubectl --context production rollout undo deployment/notifications
```
This automatically rolls back to the previous revision. Kubernetes keeps the 10 most recent revisions by default.

### Step 3: Verify the rollback
```bash
kubectl --context production rollout status deployment/notifications --timeout=120s
```
Wait for the rollout to complete. Check the dashboard to confirm the issue is resolved.

### Optional: Rollback to a specific older revision
If you need to go back more than one revision, you can specify which one:
```bash
kubectl --context production rollout undo deployment/notifications --to-revision=<revision-number>
```
Get the revision number from the history command in Step 1.

### Note on config maps
Config maps are managed separately from the image. If config changes were deployed with the bad release, rolling back the image does NOT roll back config. Check if config was changed recently — if so, you may need to revert that separately. Config changes are usually tracked in git history or the release notes.
