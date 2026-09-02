# Releasing the notifications service

## Deploy

1. Merge to `main`. CI builds and pushes the image.
2. Run `./scripts/deploy.sh production` once CI is green.
3. Watch the dashboard for a few minutes.

## Emergency Rollback

If deployment is broken and needs to be rolled back immediately:

### 1. Find the current deployed revision

```bash
kubectl --context production get deployment notifications -o jsonpath='{.spec.template.spec.containers[0].image}'
```

This shows the current image tag (commit SHA). Note this down.

### 2. Find the previous good revision

Check the git log for recent commits to `main`:

```bash
git log --oneline -10 main
```

The revision you just deployed is the current `HEAD`. Look at the previous commit(s) before the current one to find a revision that was stable. You can also check:
- Deployment timestamps: `kubectl --context production rollout history deployment/notifications`
- Recent CI runs: Check GitHub Actions for the last successful build

Pick a commit SHA from git history that you know was working.

### 3. Deploy the previous revision

Use the same deploy process with the known-good commit SHA:

```bash
kubectl --context production set image deployment/notifications \
  notifications="registry.internal/notifications:${PREVIOUS_SHA}"
kubectl --context production rollout status deployment/notifications --timeout=120s
```

Replace `${PREVIOUS_SHA}` with the commit SHA you identified in step 2.

### 4. Verify the rollback

Monitor the dashboard for a few minutes to confirm the rollback is working.

### Notes

- The image tags in the registry correspond to commit SHAs pushed by CI.
- The config map is immutable once deployed, so only code changes require rollback.
- Once the incident is resolved, investigate root cause and prevent recurrence.
