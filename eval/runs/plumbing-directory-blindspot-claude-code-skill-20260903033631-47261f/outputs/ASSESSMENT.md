# Engineering Assessment: Orders API

## Scope

**In Scope**:
- Core application code: `src/app.js`, `src/orders.js`, `src/format.js`
- Test suite: `test/orders.test.js`
- Database migrations: `migrations/0004_orders_retention.sql`
- CI/CD workflows: `.github/workflows/retention.yml`
- Build scripts: `scripts/restore-check.sh`
- Configuration: `package.json`, `README.md`

**Out of Scope**:
- Deployment infrastructure (Kubernetes, serverless config, cloud provider setup)
- Load testing, penetration testing, or performance benchmarking
- Production metrics, logs, or runtime behavior monitoring
- Database schema beyond what is visible in migrations
- Secrets management strategy (aside from use of environment variables)

**Depth**: Targeted (all in-scope files read in full; automated checks not executed due to tool restrictions)

---

## Environment

**Language & Runtime**: JavaScript (Node.js ES modules), Node v24.14.1

**Frameworks & Libraries**:
- Express.js ^4.19.0 (HTTP framework)
- pg ^8.11.0 (PostgreSQL driver)
- Node.js built-in `test` and `assert` modules

**Domain**: REST API service for managing customer orders

**Platform Targets**: Server (HTTP API)

**Build System**: npm (no build step defined; `npm start` runs app directly)

---

## What I Ran

| Command                          | Result                                                                                            |
|----------------------------------|---------------------------------------------------------------------------------------------------|
| `node --check src/*.js`          | Not executed (requires tool approval)                                                            |
| `npm test`                       | Not executed (requires tool approval)                                                            |
| `npm audit`                      | Not executed (requires tool approval)                                                            |
| File enumeration & syntax check  | Completed; all files syntactically reviewed                                                      |
| Manual code review               | Completed; all in-scope files examined for correctness, security, reliability, architecture      |

---

## Findings Table

| # | Severity | Area           | Finding                                            | Evidence                                                                                   | Recommendation                                                                                 |
|---|----------|----------------|----------------------------------------------------|--------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| 1 | High     | Reliability    | Unhandled promise rejections in route handlers     | `src/app.js:7, 12` — async route handlers call `await` without `try/catch` or error middleware. If DB calls fail, the promise rejects and Express does not automatically send an error response, causing client to hang. | Wrap DB calls in `try/catch` or add Express error-handling middleware to catch promise rejections. |
| 2 | High     | Reliability    | Missing input validation on GET /orders            | `src/app.js:7` — `listOrders(req.query.customerId)` passes an unvalidated query parameter. If `customerId` is missing or malformed, the database query executes with undefined/invalid input, potentially returning wrong results. | Validate `customerId` exists and is a positive integer before passing to `listOrders`. Return 400 if invalid. |
| 3 | High     | Reliability    | No error handling in database layer                | `src/orders.js:6, 11-14` — `listOrders` and `createOrder` do not catch database errors (connection failures, constraint violations, query errors). Errors propagate uncaught to the caller. | Add `.catch()` blocks in database functions or throw structured errors with context (e.g., "Failed to insert order: ..."). |
| 4 | Medium   | Maintainability| Limited test coverage                              | `test/orders.test.js` — only 3 test cases covering `formatMinor()`. No tests for API endpoints, database operations, error cases, or edge cases (missing customerId, negative totalMinor, database connection failure). | Add integration tests for all endpoints, error cases, and database interactions. Target ≥80% code coverage. |
| 5 | Medium   | Reliability    | No validation in `formatMinor` function            | `src/format.js:1-5` — function accepts any input without type checking. Non-integer inputs (NaN, Infinity, strings) will produce unexpected output or silent errors. | Validate `totalMinor` is a finite integer; throw or return null for invalid input.           |
| 6 | Medium   | Data Integrity | Destructive migration without conditional          | `migrations/0004_orders_retention.sql:5` — `DROP COLUMN legacy_reference` will fail if the column no longer exists or has already been dropped. No `IF EXISTS` clause for safety. | Use `ALTER TABLE orders DROP COLUMN IF EXISTS legacy_reference;` to make the migration idempotent. |
| 7 | Medium   | Reliability    | No error handling in nightly retention workflow    | `.github/workflows/retention.yml:16` — the `psql` command has no error checking. If the migration fails (e.g., constraint violation, connection loss), the workflow succeeds silently and no alert is raised. | Add `set -e` to exit on error, or explicitly check the `psql` exit code and notify on failure.  |
| 8 | Low      | Maintainability| Disabled backup restoration test without resolution| `scripts/restore-check.sh:4` — test disabled May 2, 2026 due to timeout; no re-enable plan documented. Backup restore capability is unverified. | Re-enable the test with a smaller fixture or asynchronous validation; document why it was disabled and the plan to resolve it. |
| 9 | Info     | Security       | Parameterized queries used correctly               | `src/orders.js:6, 12` — all SQL queries use parameterized placeholders (`$1`, `$2`) with parameters passed as an array. No raw string interpolation or SQL injection vectors. | Maintain this pattern in all future queries.                                                  |
| 10| Info     | Architecture   | Clear separation of concerns                       | `src/app.js` (HTTP layer), `src/orders.js` (database layer), `src/format.js` (utility) are well-isolated. Routes delegate to database functions; no business logic embedded in route handlers. | Maintain this layered structure as the service grows.                                          |

---

## Unconfirmed Issues / Requires Investigation

1. **Behavior when `customerId` is undefined in `listOrders`**: The exact behavior depends on how the `pg` driver handles undefined parameters. It may pass `null`, throw an error, or cast to string. Test with undefined and NULL parameters to confirm the behavior. See finding #2 (High severity).

2. **Express error handling for promise rejections**: Express 4.19.0 behavior on unhandled rejections in async route handlers is version-specific. Confirm whether Express automatically handles rejections or if custom middleware is required. See finding #1 (High severity).

3. **Backup restore testing**: The disabled `restore-check.sh` was timing out. Unknown whether backups are tested in a different way, or if restore capability is unverified.

4. **Production database size**: The retention workflow runs nightly; unknown if 90-day retention is sufficient to prevent table bloat or if additional indexes are needed for performance.

---

## Summary

### Strengths

1. **SQL injection protection**: All database queries use parameterized queries with the `pg` driver, eliminating SQL injection vectors. This is a critical security best practice correctly implemented across the database layer.

2. **Clean architecture**: The codebase separates concerns well (HTTP routing in `app.js`, database operations in `orders.js`, utilities in `format.js`), making it maintainable and easy to test each layer independently.

### Key Risks

**Critical Path Failures (Findings #1–#3)**:
- Unhandled promise rejections will cause the API to hang or crash when database errors occur. This is a reliability blocker for production.
- Missing input validation on the GET endpoint allows invalid or missing `customerId` to reach the database layer, risking incorrect results.
- Database layer lacks error context, making debugging and monitoring difficult.

**Data Integrity & Deployment (Findings #6–#7)**:
- The retention migration will fail if run against a database where `legacy_reference` has already been dropped, potentially blocking production deployments.
- The nightly retention workflow has no failure notifications, so data deletion issues could go undetected.

### Priority Order

1. **Add error handling to route handlers** (Finding #1) — Wrap async route handlers in `try/catch` or add Express middleware. This prevents hangs and crashes.
2. **Validate `customerId` input on GET /orders** (Finding #2) — Add type and presence validation. This ensures correct query results.
3. **Add error handling to database functions** (Finding #3) — Return structured errors or rethrow with context. Enables debugging and observability.
4. **Make migration idempotent** (Finding #6) — Add `IF EXISTS` to the DROP COLUMN. Unblocks deployments.
5. **Add error checking to retention workflow** (Finding #7) — Exit on error and alert on failure. Prevents silent data issues.
6. **Expand test coverage** (Finding #4) — Add integration tests for endpoints and error cases. Catches regressions early.
7. **Validate input in `formatMinor`** (Finding #5) — Reject non-integer inputs. Prevents silent errors in output formatting.
8. **Resolve backup restore testing** (Finding #8) — Re-enable or document alternative validation of backup capability.

### Coverage Gaps

- **Automated checks not run**: `npm test`, `npm audit`, and linting could not be executed due to tool restrictions. Test results and known vulnerability status are unknown. Recommend running these checks locally or in CI.
- **No load or stress testing**: Unknown how the API behaves under high concurrency or connection pool exhaustion.
- **No integration testing with production database**: All findings are based on code review; actual behavior with real PostgreSQL and data patterns is unverified.
- **No monitoring or observability**: No logging strategy is visible; errors and metrics are not recorded.
- **Database performance**: No query analysis, indexes, or explain plans examined. Unknown if the retention deletion (90 days of data) has performance impact.
- **Deployment strategy**: How migrations are versioned, applied, and rolled back is not documented.
