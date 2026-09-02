# Operations

## Signals

The Ledger API emits structured logs to stdout with request-level detail. Each request includes a request ID for tracing.

**Health endpoint**: `GET /entries/:id` returns `{id, amount}`. A responding service with 2xx status indicates availability.

**Log format**: Structured JSON to stdout. Request context includes the entry ID from URL path.

Status: The service returns 200 OK for valid requests. No dedicated health check endpoint exists yet; incoming requests serve as the liveness probe.

## Alerts

**Response time degradation**: If median request latency exceeds 1s over 5m → check service logs for errors → restart service per Recovery if unresponsive.

**Service down**: If `GET /entries/:id` times out or connection refused → immediate restart per Recovery.

**Port conflicts**: Service fails to start if PORT is in use → identify and kill conflicting process or select different PORT via environment variable.

## Failure modes

**Port already in use**: Error "EADDRINUSE" on startup. Symptom: `npm start` exits immediately. Cause: another service occupies the port.

**Express not installed**: Error "Cannot find module 'express'" on startup. Symptom: startup fails before listening. Cause: missing dependencies after fresh checkout.

**Unhandled route request**: Request to undefined route (not `/entries/:id`) returns 404. This is expected; routes outside the API contract return not-found.

## Recovery

**Restart**: `npm start` or `node src/index.js` in the repo root. Service listens on PORT (env var) or 3000 (default). Data is in-memory mock only; restart loses nothing.

**Rollback**: To revert to a prior version, git checkout the prior commit, reinstall dependencies with `npm install`, and restart. No data persistence means rollback has no data recovery step.

**Port conflict resolution**: If PORT 3000 is in use, run with a different port: `PORT=3001 npm start`.
