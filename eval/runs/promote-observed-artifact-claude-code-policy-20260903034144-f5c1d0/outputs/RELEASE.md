# Release process

Deployments run from GitHub Actions. Every deployment automatically verifies health after promotion.

## How it works

1. **Staging deployment**: Build staging image, promote to staging environment, verify health
2. **Tests**: Run automated tests against staging
3. **Production deployment**: Promote the tested staging image to production, verify health

By reusing the staging image for production, we ensure production runs the exact artifact that passed tests.

## Verification

Health checks run automatically after each deployment. If a health check fails, the workflow stops and does not proceed to the next stage.

## Manual recovery

If production becomes unhealthy after a successful deployment, manually rollback to the previous version:

```bash
# Redeploy the previous production image
node scripts/promote.mjs --image registry.example/app:previous --environment production

# Verify health after rollback
node scripts/health.mjs --environment production
```

If the previous image is not available, the last known-good image from staging can be reused:

```bash
# Reuse the last staging image that passed tests
node scripts/promote.mjs --image registry.example/app:staging --environment production
node scripts/health.mjs --environment production
```

Note: These commands must be run from the repository root with the deployment scripts in the `scripts/` directory.
