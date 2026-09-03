# Release process

Deployments run from GitHub Actions. A single build artifact is promoted through staging → production.

## Release

Push to `main` branch to trigger the release workflow, which:
1. Builds a single image once
2. Promotes the image to staging and verifies health
3. Runs integration tests
4. Promotes the same image to production and verifies health

Monitor the workflow at https://github.com/example/app/actions/workflows/release.yml to confirm each stage succeeds and health checks pass.

## Verification

After release to production, verify health:

```bash
node scripts/health.mjs --environment production
```

If this returns non-zero exit code, the service is not healthy and a rollback is required.

## Rollback

If production is unhealthy after deployment:

```bash
node scripts/rollback.mjs --environment production
node scripts/health.mjs --environment production
```

The rollback command restores the previous version. Verify it is healthy with the health check command above.
