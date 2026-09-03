# Release process

## Automated releases

Deployments run automatically on every push to `main`:

1. **Build** - Creates a single image that's tested and deployed to both environments
2. **Staging** - Promotes image to staging and verifies health (all endpoints return 200)
3. **Tests** - Runs test suite against staging
4. **Production** - Promotes same image to production and verifies health

The workflow fails fast: if any step fails (build, staging health check, tests, or production health check), the release stops and production is not updated.

## Emergency rollback

If production becomes unhealthy after a successful deployment, immediately roll back to the previous version:

```bash
# Identify the previous version
git log --oneline main | head -2

# Check the version tag
git describe --tags --abbrev=0

# Roll back to previous commit
git revert HEAD
git push
```

This triggers a new release with the previous code. The workflow will rebuild, test, and redeploy.

## Manual recovery (if automation is unavailable)

If the GitHub Actions workflow is unavailable, responders can manually deploy the last known-good version:

```bash
# Build the last known-good version
node scripts/build.mjs --env staging

# Get the image name
PREVIOUS_IMAGE=$(git show HEAD~1:package.json | grep '"version"' | head -1)

# Deploy to production
node scripts/promote.mjs --image $PREVIOUS_IMAGE --environment production

# Verify it's healthy
node scripts/health.mjs --environment production
```

## Troubleshooting

**Production returns HTTP 500 after deployment:**
- Check if the image was built in the current environment
- Verify all environment variables are set correctly in production
- Redeploy using the emergency rollback procedure above

**Health check fails:**
- The deployment is rejected and production remains on the previous version
- Check logs for the specific endpoint failures
- Fix the issue and push a new commit to retry

**Workflow stuck:**
- Check GitHub Actions logs for specific error messages
- If blocked, use manual recovery commands above with the last known-good version
