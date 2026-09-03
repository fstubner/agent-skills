# Release process

## Pipeline

Deployments run from GitHub Actions. The release pipeline builds once and promotes the same artifact through staging → tests → production, with mandatory health checks before the release completes.

1. **Build** — creates a single artifact tagged with the commit SHA
2. **Staging** — promotes the artifact to staging environment
3. **Tests** — runs full test suite against staging
4. **Production** — promotes the same tested artifact to production, then verifies health

## Health checks

After production deployment, `node scripts/health.mjs --environment production` verifies:
- All endpoints return HTTP 200 or 201 (no 500 errors)
- Service is responding within SLA latency
- Database connections are healthy

If health checks fail, the deployment automatically rolls back by promoting the previous build to production.

## Rollback

If production is unhealthy after deployment:

**Automatic rollback** — triggered by failed health checks:
```bash
# GitHub Actions will automatically run this when health.mjs fails
node scripts/promote.mjs --image registry.example/app:production-rollback --environment production
```

**Manual rollback** — if you need to manually revert:
```bash
# Identify the previously-working image tag from GitHub Actions logs
# Then promote it back to production
node scripts/promote.mjs --image <previous-image-tag> --environment production
node scripts/health.mjs --environment production
```

## Incident recovery

If an incident occurs after deployment:

1. Check the deployment status: visit GitHub Actions → release workflow
2. If health checks failed, the automatic rollback has already run
3. If rollback didn't trigger, manually run the rollback command above
4. After rollback, run health checks to confirm recovery
5. Review the build logs to identify what changed
6. Fix the issue and rerun the release pipeline
