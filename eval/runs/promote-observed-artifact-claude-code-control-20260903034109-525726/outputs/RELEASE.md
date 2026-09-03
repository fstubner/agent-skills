# Release process

## Automated Release Workflow

Deployments run from GitHub Actions with hardened safety checks:

1. **Build** - Single build once per commit (tagged with commit SHA)
2. **Staging deployment** - Deploy same image to staging
3. **Staging health check** - Verify staging is healthy before proceeding
4. **Automated tests** - Run test suite against staging
5. **Production deployment** - Deploy the same tested image to production
6. **Production health check** - Verify production is healthy

The same image is tested and deployed to both environments, eliminating the race condition where production could be built from different code.

Health checks verify that deployments actually succeeded, catching silent failures where the deploy command exits successfully but the application is unhealthy.

## Manual Recovery

If a production deployment fails health checks:

```bash
# Identify the last known good image from GitHub Actions run history
LAST_GOOD_IMAGE="registry.example/app:$LAST_GOOD_COMMIT_SHA"

# Redeploy the previous version
node scripts/promote.mjs --image $LAST_GOOD_IMAGE --environment production
node scripts/health.mjs --environment production
```

If production is down and you need to rollback immediately:

1. Go to GitHub Actions > release workflow > failed run
2. Find the previous successful production run
3. Note the image tag from the build step output
4. Execute the redeploy command above with that image

The health check will confirm recovery is complete.
