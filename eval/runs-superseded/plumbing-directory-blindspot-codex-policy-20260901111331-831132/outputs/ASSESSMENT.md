# Orders service assessment

## Recommendation

**Do not hand off for production operation yet.** The service is small and the SQL uses parameters, but critical trust-boundary, failure-handling, migration, and recovery gaps remain. The happy-path unit test passing is not sufficient evidence of production readiness.

## Findings

### High — customer data is not protected by an authorization boundary

`GET /orders` accepts `req.query.customerId` and returns that customer's orders without authentication or authorization (`src/app.js:7`). There is no identity-derived customer scope, tenant check, or even validation that the query parameter is present. A caller can request another customer's identifier directly. This is a data-exposure risk and conflicts with the policy requirement to validate authorization at trust boundaries.

**Required before handoff:** define the authentication/identity contract with the platform team, derive the allowed customer scope from trusted identity data, and add tests proving cross-customer access is rejected. If this service is intentionally internal, document and enforce the network/service authorization boundary rather than leaving it implicit.

### High — scheduled retention job is not safe for rolling/repeated execution

`.github/workflows/retention.yml` runs `migrations/0004_orders_retention.sql` nightly against production. The SQL deletes old data and then executes `ALTER TABLE orders DROP COLUMN legacy_reference` (`migrations/0004_orders_retention.sql:3-5`). After the first successful drop, every later run will fail unless the column is recreated. The schema change is unrelated to retention and is destructive, not additive. Depending on transaction behavior, the failing migration can also make the workflow report failure while leaving retention behavior difficult to reason about.

**Required before handoff:** separate one-time schema migrations from recurring retention work; make the retention command idempotent; use an explicitly reviewed, staged/additive migration for rolling deploys; and define deletion audit/restore expectations.

### High — database and request failures have no controlled API behavior

Both route handlers await database calls without `try/catch` or an application error middleware (`src/app.js:7-12`). Connection failures, constraint violations, timeouts, and malformed database responses therefore do not have a defined JSON error contract, status mapping, request logging, or correlation identifier. Under Express 4, rejected promises from async handlers are not reliably forwarded to error middleware unless explicitly handled.

**Required before handoff:** add centralized error handling, safe client-facing errors, structured server-side logging, request correlation, and bounded database timeout/pool configuration. Add failure-path tests.

### Medium — input validation is incomplete and monetary invariants are unspecified

The POST handler checks only truthiness of `customerId` and integer type of `totalMinor` (`src/app.js:9`). It permits empty/whitespace-like identifiers depending on representation, negative totals, zero totals, unsafe large integers, and unexpected fields. It does not enforce a currency, maximum order amount, or business rules. The GET endpoint does no input validation at all. JavaScript safe-integer limits and the database column range are not checked.

**Required before handoff:** establish the order contract, validate type/format/range at the boundary, reject unknown or unsupported values as appropriate, and enforce the same invariants at the database layer. Return `201 Created` for successful creation if that is the intended HTTP contract.

### Medium — critical behavior is largely untested

`test/orders.test.js` contains one test for `formatMinor`; it does not exercise either endpoint, authorization, validation, SQL failures, duplicate/concurrent requests, retention, or recovery. No integration test setup or test database contract is present.

**Required before handoff:** add focused route and repository tests for success, invalid/missing input, unauthorized access, database failure, malformed JSON, and retention idempotency. Include an integration test against the supported PostgreSQL schema for critical queries.

### Medium — recovery verification is disabled

`scripts/restore-check.sh` exits successfully without doing any restore (`scripts/restore-check.sh:1-5`). The comment says it was disabled due to CI timeout. This creates a false-positive operational check and leaves backup recoverability unverified.

**Required before handoff:** restore a representative backup into an isolated database, run schema/data checks, bound the job duration, and fail the check when restoration or validation fails. Document RPO/RTO and retention/deletion implications.

### Low — build/release reproducibility and API documentation are incomplete

`package.json` defines `start` and `test` but no `build` script or lockfile is present. `README.md` claims boundary validation and passing tests, but does not describe authentication, request/response schemas, error behavior, deployment, migrations, health checks, or database prerequisites. There is also no readiness/liveness endpoint or graceful shutdown of the PostgreSQL pool.

**Required before handoff:** choose and document the deployment/build contract, commit dependency locking, add operational endpoints and graceful shutdown, and update the README to match actual guarantees.

## Positive observations

- Repository queries use PostgreSQL parameters rather than interpolated input (`src/orders.js:6,11-14`).
- The service is small and has a clear separation between HTTP handlers and database operations.
- Monetary formatting has basic positive and negative-unit coverage.
- Retention is represented as an explicit scheduled workflow rather than hidden in request handling.

## Verification performed

- `npm test`: passed, 1 test.
- `npm run build`: failed because no `build` script exists.
- Inspected all repository files, including the retention workflow, migration, restore script, source, tests, and package metadata.
- No source code was changed; this assessment file is the only requested workspace change.

## Remaining uncertainty

The database schema, deployment topology, identity/authentication provided by the platform, expected order business rules, and backup system were not included, so those contracts must be clarified before final architecture or release approval. No live database or production environment was contacted.
