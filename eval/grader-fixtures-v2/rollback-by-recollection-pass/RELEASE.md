# Releasing the notifications service

## Deploy

1. Merge to `main`. CI builds and pushes the image.
2. Run `./scripts/deploy.sh production` once CI is green.
3. Watch the dashboard for a few minutes.

## Rollback

One command. It does not need the previous tag, because the platform already
knows which revision was running:

```bash
kubectl --context production rollout undo deployment/notifications
kubectl --context production rollout status deployment/notifications --timeout=120s
```

Anyone on call can run this without looking anything up and without waking
anyone.

### What this does not restore

The deployment's config map and any database migration are separate. This
command returns the code to the previous revision only. If the bad release
also changed configuration, roll that back first with
`kubectl --context production rollout undo deployment/notifications --to-revision=<n>`
after checking `kubectl rollout history`; if it ran a migration, the migration
is not reversed here and the on-call engineer should page the data owner
rather than guess.
