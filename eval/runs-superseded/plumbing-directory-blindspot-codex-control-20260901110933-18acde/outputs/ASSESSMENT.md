# Orders service assessment

## Executive summary

This service is not ready for an unqualified platform handoff. The core SQL uses parameters, but the HTTP and operational boundaries are not production-safe: malformed or missing inputs can reach the database, async failures are not handled, there is no authentication or request/availability control, and the only automated test does not exercise the service or database. The retention path is especially high risk because it performs irreversible deletion while the documented restore verification is disabled.

## Findings

### Blockers before production

1. **Retention and recovery are unsafe.** `migrations/0004_orders_retention.sql` permanently deletes all rows older than 90 days and then drops `legacy_reference`. It is run directly against the production database by the nightly GitHub Actions workflow. There is no transaction/backup gate, dry run, deletion audit, or explicit `ON_ERROR_STOP` handling in the workflow. `scripts/restore-check.sh` exits successfully without doing anything, so backup recoverability is not verified. Confirm the retention policy and migration intent, take a tested backup, make the purge idempotent and observable, and restore-test backups before enabling this in production.

2. **The API has no reliable error boundary.** Both route handlers are `async` and pass database failures directly through Express 4. There is no `try/catch` or error middleware, so a rejected query can become an unhandled request failure (and potentially an unhandled rejection) rather than a controlled JSON 5xx response. Add centralized async error handling, safe client responses, structured server logging, and correlation/request IDs.

3. **GET input is not validated.** `/orders` calls `listOrders(req.query.customerId)` for every request, including a missing, empty, repeated, or unexpectedly shaped value. The endpoint should reject invalid input with 400/422 before querying, enforce a documented length/character constraint, and define pagination and maximum page size. Otherwise callers can receive ambiguous empty results and the database can be exposed to unbounded reads.

4. **Order invariants are not enforced.** POST only checks truthiness of `customerId` and integer-ness of `totalMinor`; it accepts negative totals, zero, arbitrary types that happen to pass truthiness, and values outside the intended monetary range. There is no evidence of database constraints for these invariants or an idempotency mechanism, so retries can create duplicate orders. Define the business rules, validate them at the boundary, enforce them in the schema, and support an idempotency key if clients may retry.

### High priority

5. **No authentication, authorization, or tenant isolation is visible.** Any caller able to reach the process can list orders for an arbitrary customer ID or create orders for one. Before exposure, put the service behind the platform identity layer and enforce the caller’s permission to access the requested customer, with audit logging.

6. **Resource controls and lifecycle handling are missing.** `express.json()` has no explicit body limit, and the PostgreSQL pool has no visible pool sizing, connect/query/idle timeouts, or shutdown drain. There are no health/readiness endpoints, startup database checks, or graceful handling of `SIGTERM`. Add platform-appropriate limits, timeouts, probes, graceful shutdown, and metrics for request latency, errors, pool saturation, and database failures.

7. **HTTP contract is underspecified.** Successful creation returns the default 200 rather than a clear 201 response, there is no response schema/versioning, and malformed JSON will use framework-default behavior. Define status codes and error shapes, including validation, not-found/empty-list, conflict/idempotency, and dependency-failure cases.

### Medium priority

8. **Test coverage is not representative.** The sole test covers `formatMinor`, which is not used by either route. There are no route tests, validation tests, authorization tests, error-path tests, SQL integration tests, migration tests, retention tests, or restore tests. Add unit and HTTP contract tests plus an ephemeral PostgreSQL integration suite; include migration and backup-restore checks in CI.

9. **Configuration and dependency hygiene need platform ownership.** `DATABASE_URL` is passed to the pool without an explicit startup check or documented secret/TLS requirements; `PORT` has only a fallback. Pin dependency versions (or maintain a lockfile), scan them in CI, and document required environment variables, TLS verification, migrations, and operational SLOs.

## Handoff recommendation

Hand off for remediation/design review only, not production operation. The platform team should first establish the API security and data-retention contract, then add validation/schema constraints and controlled error handling, followed by probes, timeouts, shutdown behavior, observability, representative tests, and a real restore drill. A staged deployment against non-production data should precede any production retention run.

## Verification performed

- Inspected the application, package configuration, migration, retention workflow, restore script, and tests in the workspace.
- Ran `npm test`: 1 test passed.
- Confirmed the restore-check script currently exits 0 without performing a restore.
- No application code was changed.
