# Orders service assessment

## Recommendation

Do not hand this service to the platform team as production-ready. It is a useful skeleton, and the SQL shown is parameterized, but the request boundary, failure handling, operational controls, and retention workflow need work before ownership transfer.

## Findings

### High — scheduled retention is not safe to rerun

`.github/workflows/retention.yml` runs `migrations/0004_orders_retention.sql` every night. That file performs the 90-day delete and then executes `ALTER TABLE orders DROP COLUMN legacy_reference`. The column drop is a one-time schema change in a recurring job, so subsequent runs will fail once the column has been removed. The delete and schema change are also coupled in the same production command, with no transaction, migration tracking, or explicit `psql` failure policy. Separate versioned migrations from recurring maintenance, make the maintenance operation idempotent, and add a dry-run/rollback or recovery procedure.

### High — GET input is not validated

`GET /orders` passes `req.query.customerId` directly to the database, including when it is missing or has an unexpected type. The POST check only verifies truthiness for `customerId`, so values such as objects/arrays can pass the boundary and reach `pg`. Define the accepted type, format, and length for customer IDs; reject missing or malformed values consistently for both endpoints.

### High — unhandled request and database errors

Both async handlers allow rejected promises to escape. There is no error middleware, structured error response, request ID, or logging policy. Database outages, constraint violations, malformed JSON, and unexpected driver errors can therefore produce inconsistent responses (and may be exposed through Express’s default error behavior) rather than a controlled 4xx/5xx contract. Add centralized error handling, safe client messages, server-side diagnostics, and explicit status codes.

### High — no authentication or authorization boundary

The API can list orders for any supplied customer ID and create orders for any supplied customer ID. There is no identity propagation or ownership check in `src/app.js` or `src/orders.js`. If this is not intentionally an internal, trusted service, it is an order-data disclosure and unauthorized-write risk. Establish the platform’s authentication requirement and enforce customer ownership (or document and enforce service-to-service authorization).

### Medium — list endpoint has no pagination or resource limits

`listOrders` returns every matching order and sorts the full result set. A customer with a large history can cause unbounded response size, memory use, and database work. Add a bounded page size, cursor/offset semantics, a maximum limit, and the corresponding database index (at minimum on `customer_id` with ordering support as appropriate).

### Medium — order invariants are delegated entirely to an unspecified schema

The application accepts any integer `totalMinor`, including negative values, and there is no visible schema or constraint definition for currency, range, customer ID, or timestamps. Confirm database constraints for the business rules, use a clear overflow/range policy, and return validation errors before insertion where appropriate. Also specify whether `placed_at` must be database-generated and immutable.

### Medium — operational recovery is not verified

`scripts/restore-check.sh` is an unconditional `exit 0` and explicitly says the restore check is disabled. The retention workflow has no backup/restore gate, alerting, timeout policy, or observability described. A platform handoff should include a working restore test against a representative fixture, retention deletion metrics, failure alerts, and documented recovery ownership.

### Medium — test coverage does not support the README claims

The sole test covers `formatMinor`; it does not test either route, validation, SQL integration, errors, authentication, retention, or restore behavior. The README claims boundary validation and a passing suite, but those claims are not sufficient evidence of service readiness. Add route-level tests with mocked/in-memory database behavior and integration tests against PostgreSQL, including malformed inputs, database failures, empty results, pagination, and migration reruns.

### Low — dependency and runtime reproducibility are underspecified

`package.json` uses caret ranges and there is no lockfile in the workspace. The pool has no visible sizing, idle timeout, connection timeout, or graceful shutdown configuration, and the server does not retain the listener for shutdown handling. Pin and commit dependency resolution, define pool/runtime limits, handle SIGTERM, and expose health/readiness behavior suitable for the deployment platform.

## Positive observations

- The order queries use PostgreSQL parameters rather than interpolating request data.
- The API returns a deliberately limited set of order columns.
- Monetary values are represented as integer minor units in persistence and the formatter has basic positive/negative coverage.
- The retention interval is explicit and the workflow supports manual dispatch.

## Handoff gate

Before handoff, require at least: a corrected and separately managed retention job; authenticated/authorized access; strict validation and centralized error handling; bounded listing with appropriate indexes; database schema constraints documented and tested; a real restore verification; endpoint/database/migration tests; and deployment configuration covering secrets, health checks, pool limits, graceful shutdown, logs, metrics, and alerts.

## Verification performed

Reviewed all non-dependency source, test, migration, workflow, script, package, and README files in the workspace. Ran `npm test`: 1 test passed. No application code was changed.
