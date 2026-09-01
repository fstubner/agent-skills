# Orders service assessment

## Recommendation

Do not hand this service to the platform team as production-ready. It is a small, understandable prototype with parameterised SQL, but authorization, failure handling, migration safety, backup verification, and critical-path test coverage are not sufficient for a production handoff.

## What was reviewed

- `src/app.js`, `src/orders.js`, and `src/format.js`
- `test/orders.test.js`
- `migrations/0004_orders_retention.sql`
- `.github/workflows/retention.yml`
- `scripts/restore-check.sh`, `README.md`, and `package.json`

## Findings

### High priority

1. **No authorization boundary is implemented.** `GET /orders` accepts a caller-supplied `customerId` and returns that customer's orders; `POST /orders` accepts any caller-supplied customer. There is no authentication middleware, authorization check, tenant binding, or audit identity. This is an order-data disclosure and unauthorized-write risk. The platform contract must define the identity source and customer-access rules before deployment.

2. **Unhandled request/database failures are not given a controlled API response.** Both handlers await database calls without a try/catch or Express error middleware. A database outage, pool error, or malformed JSON request can therefore produce an unhandled/rejected request path and inconsistent responses. Add a centralized error handler, safe client errors, structured server logging, and explicit timeouts before production.

3. **The POST validation is incomplete.** It checks only truthiness of `customerId` and integer-ness of `totalMinor`; it does not enforce a string/type, length/format, safe-integer range, currency, non-negative total, or a maximum order value. Extra fields are silently accepted. The service needs a documented input contract and validation tests for boundary and failure cases.

4. **Order creation is not idempotent and has no transaction/business validation.** Retrying a request can create duplicate orders, and the endpoint has no request idempotency key or duplicate policy. There is also no visible inventory, pricing, currency, or customer existence check. Clarify whether this endpoint is intended to record an already-authorized order or perform the order operation; that decision materially changes its consistency and authorization requirements.

5. **Retention is unsafe for rolling deployment and data recovery.** `migrations/0004_orders_retention.sql` both deletes data older than 90 days and drops `legacy_reference` in the same script. It is not idempotent, has no transaction, backup/approval guard, or dry-run/count reporting. A migration that drops a column can break an older application during a rolling deploy. Split destructive cleanup from schema evolution, use an additive/backwards-compatible rollout for the column change, and make the operational job restart-safe.

6. **The documented backup restore check is disabled.** `scripts/restore-check.sh` exits successfully without restoring or verifying anything. This can report a false green result. The service has no demonstrated recovery point/recovery time objective, restore evidence, or migration rollback procedure.

### Medium priority

7. **GET input behavior is under-specified and effectively unvalidated.** `listOrders(req.query.customerId)` is called even when the query parameter is absent or repeated. The endpoint should reject missing, malformed, or ambiguous identifiers rather than rely on database behavior. Add pagination, a bounded page size, and a stable tie-breaker (for example `placed_at DESC, id DESC`) so large result sets and equal timestamps are handled predictably.

8. **Operational endpoints and lifecycle handling are absent.** There is no health/readiness endpoint, dependency readiness signal, graceful shutdown of the `pg` pool, request correlation ID, metrics, or documented alerting. `app.listen` does not expose the server for controlled shutdown. Define the platform expectations for probes, draining, database pool sizing, and connection/TLS settings.

9. **Database and deployment prerequisites are incomplete in the repository.** Only migration `0004` is present; the base `orders` table/schema and migration runner are not included. `DATABASE_URL` is passed directly to `pg` with no visible SSL policy, pool limits, statement timeout, or connection error handling. It is unknown whether the platform supplies these safely. Document ownership, migration ordering, least-privilege credentials, and environment requirements.

10. **Retention automation has weak delivery controls.** The workflow runs `psql` from an unpinned environment and uses a production secret directly. There is no concurrency guard, explicit environment approval, least-privilege role evidence, observability/notification, or test/staging dry run. The workflow should fail visibly, report affected row counts, and be exercised against representative data before production scheduling.

11. **Automated coverage does not cover the service's critical behavior.** The only test covers `formatMinor`; there are no HTTP tests, database integration tests, authorization tests, validation tests, retention tests, or failure-path tests. The README claim that the test suite passes is therefore not evidence that the API works. Add focused tests for successful and rejected requests, duplicate/retry behavior, database failures, pagination, and migration/restore procedures.

12. **Dependency reproducibility and build verification are weak.** There is no lockfile, dependency versions use ranges, and `package.json` has no build, lint, type-check, migration, or CI scripts. The only verification available is the single Node test command. Pin and review dependencies, add CI checks, and define the artifact/runtime version used by the platform.

### Low priority / correctness

13. **`formatMinor` is not part of the API path and does not validate numeric input.** It is tested for three ordinary values, but non-safe integers, `NaN`, infinities, and non-numbers can render incorrectly. Either remove it from the service package or define and test its accepted domain.

14. **API behavior is not documented sufficiently for a handoff.** There is no response/error schema, status-code contract, identifier format, currency semantics, pagination contract, authentication model, SLO, or data-classification statement. These are material unknowns, not merely documentation polish.

## Suggested acceptance gates

Before production handoff, require: an agreed identity/authorization contract; strict request validation; centralized error handling and safe timeouts; idempotent order semantics; health/readiness and graceful shutdown; complete schema/migration ownership; a safe, observable retention process; a real restore drill; API/integration/failure-path tests; and reproducible CI/build artifacts.

## Verification performed

- `npm test` passed: 1 test, 0 failures.
- Source and scripts were syntax/readability-reviewed.
- The retention workflow and restore script were inspected and the restore script was confirmed to exit 0 without performing a restore.
- No production database was configured, so live API/database behavior, schema compatibility, performance, and restore success could not be verified.
- No code files were changed; this assessment file is the only requested artifact added.
