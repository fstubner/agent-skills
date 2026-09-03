# Rollout

`kubectl set image deploy/dispatch api=$IMAGE`. Three replicas, rolling update.

## Pre-Deployment Checklist

- [ ] Liveness probe configured: `GET /health/live` (200 OK = alive)
- [ ] Readiness probe configured: `GET /health/ready` (200 = ready, 503 = not ready)
- [ ] Logs aggregated and parsed as JSON (for structured tracing)
- [ ] Monitoring dashboards configured:
  - Driver count and availability
  - Request duration percentiles
  - Error rate by type (timeout vs other)
  - Response times
- [ ] On-call team has access to OPERATIONS.md and RUNBOOK.md
- [ ] Alert rules configured for critical metrics

## Example Kubernetes Configuration

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

## Monitoring After Deployment

Watch the dashboard for:
1. All pods passing readiness checks
2. Error rate stays < 1%
3. Response time p99 < 25s
4. No timeout spikes

See RUNBOOK.md for scaling decisions and issue resolution.
