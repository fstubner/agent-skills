# Dispatch API

Assigns jobs to drivers. Runs as three replicas behind a load balancer.

## Quick Start

```bash
npm install
npm start
```

Serves `POST /jobs/:id/assign` with region-based driver assignment.

## Operability

**For on-call engineers**: Start with [OPERATIONS.md](OPERATIONS.md) for quick reference and examples.

**For detailed issue resolution**: See [RUNBOOK.md](RUNBOOK.md) for common problems and solutions.

**For monitoring**: The API provides:
- `GET /health/live` - Liveness check
- `GET /health/ready` - Readiness check with driver stats
- Structured JSON logging with request tracing (X-Request-ID header)

All errors are logged with unique request IDs for end-to-end tracing.

## Architecture Notes

See [OPERABILITY_CHANGES.md](OPERABILITY_CHANGES.md) for what was added to make this API operable.
