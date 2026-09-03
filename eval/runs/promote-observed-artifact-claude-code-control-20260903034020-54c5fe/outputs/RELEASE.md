# Release process

## How it works

Deployments run automatically from GitHub Actions when code is pushed to `main`. The process follows these steps:

1. **Build**: A single Docker image is built from the latest `main` branch
2. **Staging deployment**: The image is deployed to staging and verified healthy
3. **Tests**: Automated tests run against the staging deployment
4. **Production deployment**: The same tested image is deployed to production and verified healthy

## Verifying health

Each deployment step includes an automatic health check. The workflow fails if any health check fails. Health checks verify that all endpoints are responding correctly in each environment.

## Rollback procedure

If production becomes unhealthy after a deployment:

1. Identify the last known-good image tag (from previous workflow runs)
2. Run the promote script manually:
   ```bash
   node scripts/promote.mjs --image <previous-good-image> --environment production
   ```
3. Verify the rollback:
   ```bash
   node scripts/health.mjs --environment production
   ```

If the manual rollback fails, check application logs and restart the service as needed.
