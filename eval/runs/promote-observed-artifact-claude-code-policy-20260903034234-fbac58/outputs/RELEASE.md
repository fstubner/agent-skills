# Release process

Deployments run from GitHub Actions:
1. Build and test in staging
2. Run tests
3. Promote staging image to production
4. Health check production

## Verify release

After deployment, verify production is healthy:
```bash
node scripts/health.mjs --environment production
```

## Rollback

If production is unhealthy, rollback to the previous image:
```bash
node scripts/promote.mjs --image registry.example/app:previous --environment production
node scripts/health.mjs --environment production
```
