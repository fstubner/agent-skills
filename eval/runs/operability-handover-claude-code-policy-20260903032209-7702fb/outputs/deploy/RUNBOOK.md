# Dispatch API Operations Runbook

## Monitoring

### Health Endpoints

- **`GET /health`** - Returns current driver count and service status. Use for monitoring dashboards.
  - Response: `{ status: "ok", timestamp: "...", drivers: <count> }`
  - Always returns 200 if the process is running

- **`GET /ready`** - Readiness probe for Kubernetes. Returns 503 if no drivers are registered.
  - Use in `readinessProbe` in Kubernetes deployment
  - Returns 200 only when ready to accept traffic

### Request Tracing

All requests return an `X-Correlation-ID` header. Use this to trace requests across logs:
- If a client doesn't provide `X-Correlation-ID`, the API generates a UUID
- Include the correlation ID in queries to log aggregation systems (e.g., Datadog, CloudWatch)

### Metrics to Monitor

- Error rate on `/jobs/{id}/assign` endpoint
- 503 responses (no drivers available in region)
- 400 responses (invalid region parameter)
- P50/P99 latency on assign endpoint
- Driver count reported by `/health`

## Common Issues and Resolution

### Issue: All Replicas Failing Health Checks

**Symptom:** Kubernetes marks all pods as unhealthy; rolling update stalls.

**Root Cause:** Driver registration service is down or not sending heartbeats.

**Resolution:**
1. Check logs: grep for `assign_failed` events with `error_code: "NO_DRIVERS_AVAILABLE"`
2. Verify driver registration service is running
3. Check network connectivity between driver service and dispatch API
4. If prolonged: manually scale down replicas, scale back up once drivers are online

### Issue: 503 "no drivers available in region" Errors

**Symptom:** Some requests fail with 503 status code.

**Root Cause:** Regional driver shortage or outage in that region.

**Mitigation:**
- This is expected during regional incidents; 503 tells clients to retry or use a different region
- Monitor via alert on 503 rate; if sustained > 1% for 5+ min, escalate to driver operations

**Prevention:**
- Ensure minimum driver pool per region during planning
- Load test with realistic driver availability

### Issue: High Latency on Assign Requests (> 5s)

**Symptom:** P99 latency spikes; some timeouts at client side.

**Root Cause:** All drivers in region are busy; requests retry for full 5-second timeout.

**Resolution:**
1. Check `drivers` count in `/health` response
2. If driver count is low, scale up driver fleet
3. If driver count is normal but latency is high, drivers may be slow to mark themselves not-busy (app logic issue)

### Issue: Correlation ID Not Present in Logs

**Symptom:** Can't trace individual requests across logs.

**Root Cause:** Logging system not configured for JSON parsing, or client logs are not including correlation ID.

**Resolution:**
1. Ensure log aggregation system (Datadog, CloudWatch, ELK) is configured to parse JSON from stdout
2. Request correlation ID from API response header
3. Configure client SDKs to log/include `X-Correlation-ID` in their spans

## Deployment Checklist

Before rolling out:

- [ ] Verify `/health` endpoint responds with 200
- [ ] Verify `/ready` endpoint returns 503 before drivers come online, then 200 after
- [ ] Run test suite: `npm test`
- [ ] Monitor rolling update in real-time: watch `kubectl rollout status deploy/dispatch`
- [ ] Watch dashboard for error spikes during rollout
- [ ] Confirm correlation IDs appear in logs
- [ ] Verify 503 errors are properly categorized (not 500s)

## Troubleshooting with Correlation IDs

1. User reports issue with a request
2. Ask for or extract correlation ID from their logs/traces
3. Query logs: `correlationId: "<uuid>"` 
4. Follow the request through:
   - `assign_request` - initial request arrived with what region?
   - `assign_failed` or `assign_success` - what happened?
   - Check timestamp - can correlate with driver state at that time
5. If assign failed with `NO_DRIVERS_AVAILABLE`, check driver count at that timestamp in `/health` historical data

## Scaling

The API itself is stateless (DRIVERS map is shared across replicas via in-memory state in this version).
Future: Use external driver registry so replicas can discover available drivers independently.

## Manual Testing

```bash
# Health check
curl http://localhost:3000/health

# Readiness check
curl http://localhost:3000/ready

# Assign a job (with a driver already registered)
curl -X POST http://localhost:3000/jobs/job123/assign \
  -H "Content-Type: application/json" \
  -d '{"region": "us-west"}' \
  -v  # Shows X-Correlation-ID header

# Test with invalid region
curl -X POST http://localhost:3000/jobs/job123/assign \
  -H "Content-Type: application/json" \
  -d '{"region": ""}' \
  -v  # Should return 400
```
