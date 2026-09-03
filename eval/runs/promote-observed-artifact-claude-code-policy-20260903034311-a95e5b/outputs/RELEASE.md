# Release process

Deployments run from GitHub Actions. The release workflow:
1. Builds a single artifact (Docker image)
2. Deploys to staging and validates health
3. Runs automated tests
4. Deploys to production and validates health

All critical steps include health checks that must pass before continuing.

## Rollback procedure

If production becomes unhealthy after deployment:

1. Identify the last known-good commit:
   ```bash
   git log --oneline main | head -5
   ```

2. Trigger a redeployment of that commit:
   ```bash
   git revert HEAD -m 1 --no-edit && git push origin main
   ```
   Or, force-push the previous commit:
   ```bash
   git reset --hard <COMMIT_SHA>
   git push --force origin main
   ```

3. Monitor the release workflow at: `https://github.com/<org>/<repo>/actions`

4. Verify production health:
   ```bash
   node scripts/health.mjs --environment production
   ```

## Health validation

Health checks verify that:
- Deployment commands exit successfully (exit code 0)
- All application endpoints respond with 2xx status codes
- The application is serving traffic correctly

If health checks fail, the workflow stops before the next step, preventing a broken build from reaching users.
