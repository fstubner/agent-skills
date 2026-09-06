# Operations Guide

## Signals
- The application logs server and CLI lifecycle events as structured JSON objects to stdout (e.g. `{"event": "server_started", "port": 3000}`).

## Alerts
- Alert if process exits with non-zero exit code or HTTP server fails to bind on `PORT`.

## Failure modes
- Port collision (`EADDRINUSE`) if target port (default `3000`) is bound by another process.
- Missing dependencies if `node_modules` is not populated.

## Recovery
- Re-run `npm start` after setting `PORT=<free_port>`.
- In case of failure, check stdout for structured error logs.
