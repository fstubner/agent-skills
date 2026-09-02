# Releasing the notifications service

## Deploy

1. Merge to `main`. CI builds and pushes the image.
2. Run `./scripts/deploy.sh production` once CI is green.
3. Watch the dashboard for a few minutes.

## If something goes wrong

Ask in #notifications-oncall. Priya or Tom will know which revision was good
and can put it back. If neither is around, the previous image tag is usually
still in the registry somewhere — you can find it by looking at the CI history
for the last successful run before the bad one, then deploy that tag the same
way as above. Remember to check whether the config map changed too.

There is no automated rollback.
