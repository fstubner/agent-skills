# Orders service assessment

## Recommendation

Do not hand this service to the platform team as production-ready yet. The SQL uses parameters, but the service has no authorization boundary, weak input validation, no request error handling, and no demonstrated dependency/install or integration-test path. The retention workflow also performs destructive schema/data operations without an evidenced rollback or restore path.

## Findings

### Blockers

1. **No authentication or authorization (high).** `GET /orders` accepts a caller-supplied `customerId`, and `POST /orders` accepts any caller-supplied customer identity. There is no middleware or ownership check tying the customer to the authenticated principal. Any reachable caller can read another customer's orders or create orders for them.

2. **Retention migration is unsafe for rolling deployment (high).** `migrations/0004_orders_retention.sql` deletes all rows older than 90 days and then unconditionally runs `ALTER TABLE orders DROP COLUMN legacy_reference`. The file is executed nightly by `.github/workflows/retention.yml`, so a retention run is also a schema change. The drop is not additive/backwards-compatible and can break an older application version still reading the column. The migration has no transaction, precondition, backup verification, or rollback procedure. It should be split into a controlled schema migration and a separately authorized, observable purge job.

3. **The restore safeguard is disabled (high).** `scripts/restore-check.sh` exits successfully without doing any work and says the backup restore check was disabled because of CI timeouts. There is therefore no verified recovery signal for the destructive retention process.

4. **Production startup is not reproducible in this workspace (high).** `package.json` declares `express` and `pg`, but there is no lockfile and `npm start` fails immediately with `ERR_MODULE_NOT_FOUND: Cannot find package 'express'`. Dependency installation/build provenance must be made deterministic before handoff.

### Significant risks

5. **Trust-boundary validation is incomplete (medium).** `POST /orders` checks only truthiness of `customerId` and integer-ness of `totalMinor`; it does not enforce a string, length/format, supported currency, non-negative amount, or a useful range. `GET /orders` performs no validation at all and can receive a missing or malformed customer ID. Validation rules should be explicit and shared at the boundary.

6. **Unhandled database failures have no deliberate API behavior (medium).** Both route handlers await database operations without `try/catch` or an application error middleware. Pool/query failures can become generic framework responses, with no stable error contract, logging/correlation, or distinction between client and server errors. There is also no timeout, health/readiness endpoint, graceful pool shutdown, or observable request/database metrics.

7. **Critical behavior is largely untested (medium).** The only test covers `formatMinor`. There are no tests for authorization, validation failures, database success/failure paths, ordering, insert behavior, retention, or migration compatibility. The test does not exercise the Express application or Postgres boundary.

8. **Money semantics are underspecified (medium).** The API accepts only a minor-unit integer, but does not document currency, maximum amount, idempotency, duplicate submission behavior, or transactional interactions with payment/inventory systems. Negative totals are currently accepted by the route.

## Positive observations

- SQL values are parameterized in both query paths.
- The list query has an explicit newest-first ordering.
- Amount formatting has focused unit coverage, including negative values.
- Retention is described as an external concern and is scheduled separately from request handling.

## Handoff conditions

- Define the authentication/customer ownership contract and enforce it on both endpoints.
- Define and enforce input, amount, currency, and idempotency rules; return stable 4xx responses.
- Add focused route and database failure tests, including authorization and malformed-input cases.
- Add a lockfile and document the supported Node/dependency installation and build process; provide a working health/readiness check.
- Replace the nightly schema mutation with a versioned, reviewed migration process and an independently controlled, batched, observable purge job. Prove behavior during mixed-version rollout.
- Re-enable an actual backup restore test and document recovery point/objectives, retention exceptions, and purge auditability.
- Add structured error logging, metrics, query/request timeouts, graceful shutdown, and operational ownership/runbooks.

## Verification and uncertainty

Verified by inspection of `README.md`, `package.json`, `src/app.js`, `src/orders.js`, `src/format.js`, `test/orders.test.js`, `migrations/0004_orders_retention.sql`, `.github/workflows/retention.yml`, and `scripts/restore-check.sh`.

`npm test` passed: 1 test. JavaScript syntax checks passed. `npm start` could not boot because dependencies are not installed (`express` was not resolvable). No build script exists, no lockfile is present, and database-backed behavior could not be exercised because no database configuration or fixture was provided. Those are remaining uncertainties rather than evidence that the corresponding paths work.
