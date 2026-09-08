# Orders service assessment

## Recommendation

**Do not hand this to the platform team for production deployment yet.** The SQL is parameterised and the small formatting test passes, but the service has no demonstrated production contract around validation, failure handling, access control, schema delivery, backups, or observability. The retention automation is especially risky because it executes a data purge and a schema change from the same nightly file.

## Findings

### High priority

1. **The orders API has no authentication or authorisation.** `GET /orders` accepts an arbitrary `customerId`, and `POST /orders` allows anyone who can reach the process to create orders. This is a direct customer-data disclosure and data-integrity risk unless an authenticated, trusted network boundary is guaranteed outside this repository. Define the identity-to-customer mapping and enforce it in the service or document and enforce the compensating control at the edge.

2. **The GET boundary is not validated.** `GET /orders` passes a missing, array-valued, or otherwise malformed `customerId` directly to the database. A missing value becomes a query for `NULL` and returns a successful empty list, masking client errors. Add explicit type, presence, length, and format validation and return a consistent 400 response.

3. **Unhandled request and database failures can escape the route.** Both handlers are `async` with no local handling or application error middleware. Malformed JSON and database connectivity/constraint errors are not translated into a stable error contract; depending on the Express/runtime path, clients may receive a generic 500 and operators may get noisy/unstructured failures. Add central error handling, safe client messages, request correlation, and appropriate logging/metrics.

4. **The retention workflow is not a safe migration boundary.** `.github/workflows/retention.yml` runs `migrations/0004_orders_retention.sql` against production nightly. That file both deletes all rows older than 90 days and executes `ALTER TABLE orders DROP COLUMN legacy_reference`. A repeated scheduled run will fail after the first successful run unless the column is already absent, and a failure after deletion can leave the job partially applied. Separate schema migrations from operational purge jobs; make deployment state explicit, use a transaction where appropriate, and add a tested, auditable deletion process with lock/runtime controls.

5. **Backup recovery is not currently verified.** `scripts/restore-check.sh` exits successfully without doing any work and says the check is disabled. The repository therefore provides no evidence that backups can be restored, that the schema and retention behavior are recoverable, or that RPO/RTO targets are met. Re-enable an automated restore test against a representative sanitized fixture and publish ownership and alerting.

### Medium priority

6. **Order input rules are incomplete.** `totalMinor` is only checked to be an integer. Negative values, unsafe integers beyond JavaScript's precise range, and unbounded `customerId` strings are accepted. Decide whether zero/negative totals are valid, enforce `Number.isSafeInteger` and business bounds, and validate a bounded customer identifier. Database constraints should backstop the API.

7. **The HTTP contract is underspecified.** Successful creation returns 200 rather than the conventional 201, there is no idempotency mechanism for client retries, and there is no pagination or maximum result size for listing. Ordering only uses `placed_at`, so equal timestamps can produce unstable ordering. Define status codes, retry semantics, limits, and a deterministic tie-breaker such as `id`.

8. **No health/readiness or graceful shutdown behavior is present.** The process starts even when `DATABASE_URL` is absent, and the pool is never closed on termination. Add startup configuration validation, a readiness check that verifies database reachability, liveness behavior, signal handling, and bounded database/request timeouts.

9. **The retention job lacks operational safeguards.** It has no explicit permissions, concurrency control, timeout, deletion metrics, failure notification, or evidence of a dry run. A full-table time-based delete can create long locks and transaction/WAL pressure. Batch and monitor the purge, define the retention/legal-hold policy, and alert on abnormal row counts or duration.

### Low priority

10. **The test suite does not exercise the service.** The only test covers `formatMinor`; no route, validation, database error, migration, retention, authentication, or recovery behavior is tested. Add API contract tests with a database test fixture (or a clear repository boundary), migration tests, and failure-path coverage before release.

11. **The repository has limited delivery metadata.** There is no lockfile, schema baseline/table definition, documented environment configuration, API example/specification, or CI workflow visible alongside the service. The platform handoff should include reproducible dependency installation, migration ownership/order, required secrets, supported Node/PostgreSQL versions, and deployment/rollback procedures.

## Positive observations

- Queries use positional parameters rather than interpolating request values.
- Monetary values are represented as integer minor units in the persistence API, avoiding floating-point arithmetic in the order write path.
- The formatter handles positive, negative, and sub-unit values, and the existing test passes.
- The retention interval is explicit at 90 days and is scheduled rather than run on every request.

## Handoff checklist

Before production ownership transfers, require at minimum:

- an agreed authentication/authorisation model and customer-data access test;
- validated GET and POST contracts, business/database constraints, idempotent creation, and bounded/paginated reads;
- central error handling, structured telemetry, health/readiness, timeouts, and graceful shutdown;
- a separate, tested migration path and guarded retention job;
- a real backup restore drill with measured RPO/RTO and alerting;
- integration, migration, and failure-path tests in CI; and
- deployment configuration, schema ownership, rollback instructions, and a lockfile.

## Verification performed

Reviewed all visible service source, tests, package metadata, migration, workflow, restore script, and README files in `/workspace`. Ran `npm test`; the single formatter test passed. No application code was changed.
