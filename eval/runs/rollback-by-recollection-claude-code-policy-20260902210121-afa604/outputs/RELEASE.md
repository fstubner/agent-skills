# Releasing the notifications service

## Deploy

1. Merge to `main`. CI builds and pushes the image.
2. Run `./scripts/deploy.sh production` once CI is green.
3. Watch the dashboard for a few minutes.

## Emergency rollback (no setup required)

If a deployment breaks production and you need to rollback immediately:

### 1. Find the previous known-good revision

```bash
# View deployment history to see the image tag from before the bad deploy
kubectl --context production rollout history deployment/notifications
```

Look at the list and identify the revision number before the current one. Then:

```bash
# Get the image tag of the previous revision
kubectl --context production rollout history deployment/notifications --revision=<PREVIOUS_REVISION_NUMBER>
# Extract the image tag from the "Image:" line in the output
```

Alternatively, if you need to go further back:

```bash
# View all image tags deployed in the last few days (most recent first)
kubectl --context production get deployment notifications -o jsonpath='{.status.conditions[?(@.type=="Available")].message}' && \
kubectl --context production get replicasets -o jsonpath='{range .items[*]}{.spec.template.spec.containers[0].image}{"\n"}{end}' | sort | uniq -c | sort -rn
```

### 2. Check if config map changed

```bash
# View when the configmap was last modified
kubectl --context production get configmap notifications-config -o jsonpath='{.metadata.managedFields[0].time}'
```

If the configmap was modified around the time of the bad deploy, you may need to rollback both.

### 3. Perform the rollback

Deploy the previous image tag:

```bash
# Set the image to the previous known-good revision
kubectl --context production set image deployment/notifications \
  notifications="registry.internal/notifications:<PREVIOUS_IMAGE_TAG>"

# Wait for rollout to complete (max 120 seconds)
kubectl --context production rollout status deployment/notifications --timeout=120s
```

If you rolled back the configmap separately, restore it:

```bash
kubectl --context production rollout undo deployment/notifications-config
```

### 4. Verify the rollback

```bash
# Confirm the deployment is using the previous image
kubectl --context production get deployment notifications -o jsonpath='{.spec.template.spec.containers[0].image}'

# Watch pod restarts complete
kubectl --context production get pods -l app=notifications
```

Check the application dashboard to confirm normal behavior has resumed.

### 5. Communicate

- Post in #notifications-oncall with: deployment was rolled back from `<NEW_SHA>` to `<PREVIOUS_SHA>`
- Do NOT wake the on-call engineer; if you had to rollback, that's what they're paid for
