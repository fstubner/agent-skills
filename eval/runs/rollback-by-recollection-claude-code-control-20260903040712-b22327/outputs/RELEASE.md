# Releasing the notifications service

## Deploy

1. Merge to `main`. CI builds and pushes the image.
2. Run `./scripts/deploy.sh production` once CI is green.
3. Watch the dashboard for a few minutes.

## If something goes wrong

### Quick rollback (no need to contact anyone)

To rollback without waiting for anyone or researching history:

1. **Find the previous image tag:**
   ```bash
   kubectl --context production get deployment notifications -o jsonpath='{.spec.template.spec.containers[0].image}'
   ```
   This shows the current (bad) image. The previous working version was the one before this deploy. Check the revision history:
   ```bash
   kubectl --context production rollout history deployment/notifications
   ```

2. **Rollback to the previous revision:**
   ```bash
   kubectl --context production rollout undo deployment/notifications
   ```

3. **Verify the rollback:**
   ```bash
   kubectl --context production rollout status deployment/notifications --timeout=120s
   ```

4. **Check the dashboard** to confirm the service is healthy again.

### If you need to rollback further

If the immediate previous revision is also bad, check the full revision history:
```bash
kubectl --context production rollout history deployment/notifications --revision=<number>
```

Then rollback to a specific revision:
```bash
kubectl --context production rollout undo deployment/notifications --to-revision=<number>
```

### Config map changes

Config changes are applied separately from the deployment. If the bad deploy included a config map change, you'll need to check if it also needs to be reverted:
```bash
kubectl --context production describe cm notifications-config
```

Check the recent git history or #notifications-oncall for context on what config changed.

---

There is no automated rollback, but the manual process above is straightforward and doesn't require knowing who was on duty or what was deployed — the cluster tracks all revisions automatically.
