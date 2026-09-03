# Orders Service Engineering Assessment

## Scope

**In scope:**
- `src/` — core application logic (Express routes, order operations)
- `test/` — test suite
- `migrations/` — database schema and retention policy
- `scripts/` — operational scripts
- `.github/workflows/` — CI/CD and automated jobs
- `package.json` — dependencies and build configuration

**Out of scope:**
- `.agent-input/` — assessment materials and skill documentation
- External systems (production database, secrets, deployment infrastructure)
- Load testing, penetration testing, or production monitoring

**Depth: Targeted**
All in-scope files were read in full. Automated checks (npm test) could not be executed in this environment and are noted below.

---

## Environment

**Language & Runtime:**
- JavaScript (Node.js ES modules)
- Node version not specified in package.json or dotfiles

**Framework & Libraries:**
- Express.js ^4.19.0 — HTTP server framework
- pg ^8.11.0 — PostgreSQL client library

**Domain:**
- REST API for order management
- Two endpoints: list customer orders (GET), create order (POST)
- PostgreSQL database backend
- Nightly data retention job via GitHub Actions workflow

**Build & Run:**
- npm for package management
- `npm start` — runs `node src/app.js`
- `npm test` — runs `node --test test/orders.test.js`

---

## Tooling Results

### Tools Run

No automated checks could be executed in this environment. Attempted:

- **npm test**: Approval required to execute in sandbox environment.
- **npm audit**: Approval required to execute in sandbox environment.

### Tools Not Attempted

- **eslint** / **prettier**: No linter configuration found in repo; tool not installed.
- **type-check** / **tsc**: Project uses untyped JavaScript (no TypeScript).
- **node --check**: Syntax validation not required; deferred to runtime.

### Implication

Testing and dependency auditing cannot be verified by this assessment. All findings rest on code inspection and documented evidence.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Reliability | Unhandled promise rejections in database queries | `src/orders.js:6` and `src/orders.js:11-15` — `pool.query()` calls have no error handling. Any database error (connection loss, constraint violation, timeout) will reject the promise with no catch block, crashing the request or leaving the application in a broken state. | Wrap all `pool.query()` calls in try-catch blocks or add `.catch()` handlers. Return a 500 error response with a logged error message to the client and application logs. |
| 2 | High | Reliability | Missing connection pool validation at startup | `src/orders.js:3` — The PostgreSQL connection pool is created without verifying that `DATABASE_URL` environment variable is set. If DATABASE_URL is missing or invalid, the error will not surface until the first query attempt, during request handling. | At application startup (e.g., in `src/app.js`), validate that `DATABASE_URL` is set and attempt to verify the connection (e.g., `pool.query('SELECT 1')`). Exit with a clear error message if the connection cannot be established. |
| 3 | High | Correctness | Missing input validation on GET /orders customerId parameter | `src/app.js:7` — The GET /orders endpoint accepts `customerId` from `req.query.customerId` with no validation. A client can pass `null`, `undefined`, an empty string, or a non-numeric value. The query will execute with these invalid values, potentially returning empty results or triggering unexpected database behavior. | Add validation in `src/app.js` line 7: check that `customerId` is a non-empty numeric value (e.g., `Number.isInteger(parseInt(req.query.customerId, 10))`). Return 400 with a clear error message if invalid. |
| 4 | High | Reliability | Nightly retention workflow has no failure handling or notifications | `.github/workflows/retention.yml:16` — The `psql` command that runs the retention migration has no error handling. If the migration fails (e.g., due to database unavailability or constraint violation), the workflow will silently exit with a non-zero status, and data retention may not occur. There is no alerting or retry logic. | Add `set -e` at the start of the workflow step to fail fast on errors, or use GitHub Actions `continue-on-error: false` (already default, but make it explicit). Add a separate step to send alerts (e.g., Slack notification) on failure. Test the migration manually before deployment. |
| 5 | Medium | Reliability | Test coverage limited to formatting function only; core API untested | `test/orders.test.js` — The test suite contains only 3 assertions, all testing the `formatMinor()` formatting function. No tests exist for the API endpoints (`GET /orders`, `POST /orders`), database query logic, error handling, or edge cases (e.g., negative totals, missing fields). | Add integration or end-to-end tests for: (1) `GET /orders` with valid/invalid customerId, (2) `POST /orders` with valid and invalid payloads, (3) error responses when database is unavailable, (4) constraint violations. Consider using a test database or mock pool. |
| 6 | Medium | Reliability | Backup restore verification disabled; restore capability unverified | `scripts/restore-check.sh:4` — The restore check script exits immediately with `exit 0`. The comment states it was disabled on 2026-05-02 due to CI timeouts. This means there is no automated verification that nightly backups can be restored, leaving a significant operational risk. | Re-enable the restore check with optimizations: (1) reduce the fixture database size as suggested in the comment, (2) run on a smaller subset of backups (e.g., weekly instead of nightly), (3) set a longer timeout in CI, or (4) move to a separate, less-frequent job. Establish a manual or periodic restore test plan in the interim. |
| 7 | Low | Maintainability | Missing environment variable documentation | `src/orders.js:3`, `src/app.js:17` — The code references `process.env.DATABASE_URL` and `process.env.PORT` without documenting required or optional variables in README or a `.env.example` file. New developers may not know which variables must be set. | Add a section to `README.md` listing all required environment variables: `DATABASE_URL` (required, PostgreSQL connection string), `PORT` (optional, defaults to 3000), `NODE_ENV` (optional, used to control startup). Provide an example `.env.example` file. |

---

## Unconfirmed Issues

**Database constraint violations in POST /orders**
- The `createOrder` function does not validate that `totalMinor` is within acceptable bounds (e.g., negative values, extremely large values) before inserting into the database. If the database schema includes constraints (e.g., CHECK totalMinor > 0), these violations will trigger unhandled rejections (see Finding #1). Without access to the database schema or migrations that define the `orders` table, this cannot be confirmed. Recommend: review database schema definition and add application-level validation that mirrors database constraints.

**Race condition in restoring customer order history across connections**
- If a request lists orders while a deletion (due to retention) is in progress, it may observe a partial, inconsistent view of orders. PostgreSQL's transaction isolation levels mitigate this for most cases, but without seeing the schema or connection pool configuration (isolation level), this cannot be confirmed. Recommend: verify that the pool uses an appropriate isolation level (e.g., READ_COMMITTED or SERIALIZABLE depending on requirements).

---

## Summary

### Strengths

1. **Parameterized queries throughout** — All database queries use parameterized placeholders (`$1`, `$2`) rather than string concatenation, eliminating SQL injection risk. Evidence: `src/orders.js:6` and `src/orders.js:12`.

2. **Clear, minimal API design** — The service exposes only two endpoints with simple, well-documented contracts. Evidence: `README.md` and `src/app.js`.

3. **Basic input validation on POST** — The POST /orders endpoint validates the presence and type of `customerId` and `totalMinor` before processing. Evidence: `src/app.js:9-10`.

### Key Risks

**Critical: Unhandled database errors will crash the service** (Finding #1)
- Any database connection loss, timeout, or constraint violation will result in an unhandled promise rejection, crashing the request or the entire process.

**High: Missing startup validation allows hidden configuration failures** (Finding #2)
- If `DATABASE_URL` is missing or invalid, the service will appear to start successfully but fail on the first request. This delays error detection and complicates debugging.

**High: Incomplete input validation on GET /orders** (Finding #3)
- Invalid `customerId` values are not rejected, potentially causing unexpected query behavior or empty results that are silent failures from the client perspective.

**High: Nightly data retention has no failure visibility** (Finding #4)
- If the retention job fails, there is no alerting or retry logic, leaving the service at risk of retaining data beyond the stated 90-day window.

**Medium: Core functionality untested** (Finding #5)
- Only a formatting utility is tested; the API and database logic are untested, leaving no confidence in correctness or failure modes.

**Medium: Backup restore unverified** (Finding #6)
- The automated restore check is disabled, eliminating a critical safeguard for disaster recovery.

### Priority Order

1. **Add error handling to database queries** (Finding #1) — Critical severity; required before production use. Effort: 1–2 hours.
2. **Add startup connection validation** (Finding #2) — High severity; prevents hidden failures. Effort: 30 minutes.
3. **Validate GET /orders customerId parameter** (Finding #3) — High severity; corrects a clear validation gap. Effort: 30 minutes.
4. **Add error handling and alerting to retention workflow** (Finding #4) — High severity; operational safety. Effort: 1 hour.
5. **Add API and database integration tests** (Finding #5) — Medium severity; enables future confidence. Effort: 2–3 hours.
6. **Re-enable backup restore verification** (Finding #6) — Medium severity; necessary for disaster recovery confidence. Effort: 1–2 hours (depending on database size optimization).
7. **Document environment variables** (Finding #7) — Low severity; nice-to-have. Effort: 30 minutes.

### Coverage Gaps

**Not examined:**
- **Automated testing**: `npm test` and `npm audit` could not be run in this environment. If tests fail or audit reports vulnerabilities, they are not reflected in this assessment.
- **Production database schema**: The actual table definitions for `orders` and any constraints, indexes, or triggers are not available. Recommendations about constraint validation (Unconfirmed issue) rest on inspection of the code alone.
- **Production deployment and monitoring**: No access to logs, metrics, alerting configuration, or deployment targets. Operational resilience depends on infrastructure not examined here.
- **Load testing and performance**: No analysis of query performance, connection pool sizing, or API latency under load.
- **Access control and authentication**: The API has no authentication or authorization logic visible in the code. If access control is enforced elsewhere (e.g., API gateway, reverse proxy), it was not examined.
- **Data retention compliance**: No audit of whether the 90-day retention policy meets regulatory or business requirements (e.g., GDPR, audit logs).

---

## What Was Verified

✓ All source files read in full: app.js, orders.js, format.js, test suite, migrations, scripts, workflow definitions, package.json, README.
✓ Parameterized queries verified in all database operations.
✓ Input validation on POST /orders confirmed (customerId, totalMinor type checking).
✓ Missing input validation on GET /orders confirmed.
✓ Error handling in database operations confirmed absent.
✓ Connection pool initialization confirmed as unvalidated.
✓ Nightly retention workflow examined; no error handling or alerting found.
✓ Backup restore check found disabled with explanation.
✓ Test coverage examined; only formatMinor function tested.
✓ Environment variables and startup behavior traced through code paths.
