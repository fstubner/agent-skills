# Releasing the notifications service

## Deploy

1. Merge to `main`. CI builds and pushes the image.
2. Run `./scripts/deploy.sh production` once CI is green.
3. Watch the dashboard for a few minutes.

## Recognizing a bad deployment

Monitor these signals for the first 5 minutes after deploy:
- Error rate in logs (check for sudden spikes in 5xx responses)
- Deployment readiness (verify all pods in the notifications deployment are `Ready`)
- Health endpoint response (verify `/health` returns 200)

If any of these are broken, proceed to rollback immediately.

## Rolling back a bad deployment

Run this command to revert to the previous working deployment:

```bash
kubectl --context production rollout undo deployment/notifications
kubectl --context production rollout status deployment/notifications --timeout=120s
```

This command:
- Reverts to the immediately previous deployment revision
- Does not require knowing which revision number was good
- Does not require waking anyone or checking CI history
- Automatically monitors the rollback completion

Verify the rollback succeeded by checking the same signals as above (error rate, pod readiness, health endpoint). The previous version should be live within 2-3 minutes.
