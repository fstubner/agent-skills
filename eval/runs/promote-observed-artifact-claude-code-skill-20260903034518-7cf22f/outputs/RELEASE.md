# Release process

Deployments run from GitHub Actions.

## Pipeline overview

1. **Build** — Build artifact once with git SHA
2. **Stage to staging** — Promote the same artifact to staging
3. **Health check staging** — Verify staging endpoints are healthy
4. **Test** — Run test suite
5. **Stage to production** — Promote the same artifact to production
6. **Health check production** — Verify production endpoints are healthy; auto-rollback on failure

This ensures one artifact is tested and promoted through environments, never rebuilt.

## If production is unhealthy

Health checks run automatically after production deployment. If they fail, the workflow auto-rolls back to the previous version.

If manual intervention is needed:

### Step 1: Verify the failure

```bash
node scripts/health.mjs --environment production
```

This will output `production healthy` if endpoints are responding normally, or exit with an error if they return 500s or timeouts.

### Step 2: Identify the last good version

Check recent deployments:

```bash
git log --oneline -10 main
```

Note the commit SHA of the last known good deployment.

### Step 3: Rollback to previous version

```bash
node scripts/promote.mjs --image registry.example/app:<previous-commit-sha> --environment production
```

Example: `node scripts/promote.mjs --image registry.example/app:abc123def456 --environment production`

### Step 4: Verify rollback succeeded

```bash
node scripts/health.mjs --environment production
```

Wait 10 seconds for the service to fully come online, then run again if needed.

### Step 5: Document incident

Note:
- What time the incident occurred
- Which commit was rolled back
- What the health check showed (HTTP status, error messages)
- Whether the rollback resolved it

This helps identify what went wrong in the artifact or configuration.
