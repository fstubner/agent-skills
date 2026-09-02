# Ledger API Operations

## Signals

The service emits health status on the `/health` endpoint (HTTP GET). The response is JSON:

```json
{ "status": "ok" }
```

- **Where it lands**: The health endpoint is available at `https://ledger.internal/health`
- **Correlation**: Each request carries an implicit correlation via HTTP request/response pairing; structured logging should include request IDs in production
- **Success indicator**: HTTP 200 with `{"status":"ok"}` indicates the service is healthy and ready to serve requests
- **Failure indicator**: HTTP 5xx, connection timeout, or any response other than HTTP 200 indicates the deployment is broken and needs immediate rollback

## Alerts

- **Alert trigger**: POST-DEPLOY HEALTH CHECK FAILURE
  - **Threshold**: Any failed health check in the smoke test (HTTP code != 200 or timeout)
  - **Action**: The CI/CD pipeline automatically halts the rollout and fails the deployment job
  - **First response**: Pipeline failure blocks promotion and notifies the commit author via GitHub; no deployment occurs if health is broken

## Failure Modes

1. **Service fails to start**
   - **Symptom**: Health check times out or returns HTTP 5xx immediately after deployment
   - **Cause**: Broken code in the deployed build (e.g., syntax error, missing dependency, import failure)
   - **Detection**: Caught by the smoke check in the deploy pipeline; rollback is automatic
   
2. **Kubernetes pod crash loop**
   - **Symptom**: Health check passes initially but then begins failing after 30-60 seconds; repeated curl attempts show inconsistent results
   - **Cause**: Runtime error or OOM after initialization (most common after a few requests)
   - **Detection**: The health endpoint is checked ~immediately after deploy; if the pod crashes within seconds, the smoke test catches it
   
3. **Dependency connectivity loss (e.g., database down)**
   - **Symptom**: Health check passes but `/entries/:id` endpoint returns errors; health endpoint does not currently verify dependencies
   - **Cause**: Backend dependency unavailable; service is alive but unable to function
   - **Note**: Currently NOT detected by the health check; would require adding dependency health verification to `/health` endpoint

## Recovery

### Rollback Procedure

Automatic rollback is NOT currently implemented in the deploy workflow. Manual intervention is required:

```bash
# Identify the previous good deployment
kubectl --context production rollout history deployment/ledger-api

# Rollback to the previous version
kubectl --context production rollout undo deployment/ledger-api
```

After rollback, verify the service is healthy:
```bash
curl -sS https://ledger.internal/health
```

### Restart Procedure

If a manual restart is needed:

```bash
kubectl --context production rollout restart deployment/ledger-api
```

Then verify:
```bash
curl -sS https://ledger.internal/health
```

### Data at Risk

- **Ledger entries**: Read-only API only; no data modification risk during deployment or rollback
- **No state**: The service is stateless; rollbacks do not require any data recovery procedures

## Known Gaps

- **Dependency health checks not included**: The `/health` endpoint does not verify connectivity to external dependencies (if any exist in future versions); only application startup is verified
- **No automated rollback**: Rollback must be triggered manually by on-call engineer; consider implementing automatic rollback on health check failure
- **Request-level tracing**: No correlation ID in request/response; structured logging needs to be added for better observability
