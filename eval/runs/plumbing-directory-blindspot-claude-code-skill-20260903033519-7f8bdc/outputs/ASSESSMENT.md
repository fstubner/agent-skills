# Orders API Engineering Assessment

## Scope

**In scope:**
- Core application files: `src/app.js`, `src/orders.js`, `src/format.js`
- Test suite: `test/orders.test.js`
- Database migrations: `migrations/0004_orders_retention.sql`
- Deployment automation: `.github/workflows/retention.yml`
- Operational scripts: `scripts/restore-check.sh`
- Configuration: `package.json`, `README.md`

**Out of scope:**
- Production environment configuration and secrets management
- Database schema (prior migrations)
- Load testing, stress testing, or performance profiling
- Integration testing against a live database
- User acceptance testing or product validation

**Depth:** Targeted — all in-scope files read in full; code inspection and configuration analysis performed.

---

## Environment

**Technology Stack:**
- **Language:** JavaScript (ES modules)
- **Runtime:** Node.js
- **Framework:** Express.js (^4.19.0)
- **Database:** PostgreSQL (pg ^8.11.0)
- **Testing:** Node.js native test framework (`node:test`)
- **CI/CD:** GitHub Actions

**Domain:** RESTful API service for order management with automated data retention.

**Build System:** npm scripts (start, test).

---

## Tooling Results

**Automated checks attempted:**
- `npm test` — **Not executed** (requires approval; deferred to manual code inspection)
- `npm audit` — **Not executed** (requires approval; deferred to manual inspection)
- ESLint / lint tools — **Not available** (no linting config found in package.json)
- Type checking — **Not applicable** (JavaScript, no TypeScript config)
- Build command — **Not available** (no build step defined; app.js is executed directly)

**Result:** All evidence gathered from code reading and configuration inspection. Test suite code reviewed but not executed.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Reliability | Unhandled database errors crash handlers | `src/app.js:7, 12` — `listOrders()` and `createOrder()` calls have no `.catch()` or error handling; a query failure will terminate the request handler without a response | Wrap database calls in try-catch or add `.catch()` handlers to all async pool.query calls. Return appropriate HTTP error status (500) on database failures |
| 2 | High | Correctness | NULL customerId accepted in listOrders without validation | `src/app.js:7` — GET `/orders` passes `req.query.customerId` directly to `listOrders()` without checking if it's defined; PostgreSQL `WHERE customer_id = NULL` matches no rows (correct) but the absence of validation hides the fact that no input validation occurs at this layer | Add explicit validation in the handler: `if (!req.query.customerId) return res.status(400).json({error: '...'})` before calling listOrders |
| 3 | High | Correctness | Unused code path never tested | `src/format.js:1-5` — `formatMinor()` function is tested in `test/orders.test.js` but never imported or called anywhere in `src/app.js` or `src/orders.js`; it is dead code or intended for future use | Determine if `formatMinor` is intended for a future price-formatting endpoint. If not needed, remove it. If planned, add it to the API and update tests to cover that endpoint |
| 4 | High | Data Integrity | Destructive nightly data deletion without backup verification | `migrations/0004_orders_retention.sql:3` — DELETE query runs at 2 AM UTC daily via `.github/workflows/retention.yml:16` without prior backup validation or post-deletion verification; `scripts/restore-check.sh:2-4` that should verify recovery is disabled since 2026-05-02 | Re-enable or replace backup verification. Add pre-deletion snapshot confirmation. Log deletion count and send alerts if count is 0 or unusually high. Ensure backups are tested on schedule before disabling retention |
| 5 | High | Reliability | Retention workflow missing error handling and observability | `.github/workflows/retention.yml:14-16` — the `psql` command has no error checking; if it fails silently, no alert is triggered; no logging of rows deleted | Add `set -e` or error-exit logic. Log the DELETE output (row count). Add notification/alert step on failure. Consider a dry-run audit query before deletion |
| 6 | Medium | Security | Input validation incomplete for createOrder | `src/app.js:9` — Validation checks `Number.isInteger(req.body?.totalMinor)` but does not check if totalMinor is negative or zero; a negative total would insert invalid data; no upper bound check | Add range validation: `totalMinor > 0` or `totalMinor >= 0` depending on domain rules. Reject values outside the valid range before insert |
| 7 | Medium | Architecture | No database connection lifecycle management | `src/orders.js:3` — Pool is created at module load and never explicitly closed; if the app exits, connections may not drain cleanly | Add graceful shutdown handler: call `pool.end()` on SIGTERM/SIGINT. Ensure test cleanup closes the pool after tests complete |
| 8 | Medium | Maintainability | No logging or request context tracking | `src/app.js` — No logging statements in handlers; errors and slow queries have no visibility; difficult to debug production issues | Add request logging middleware (e.g., morgan) to track request/response times, errors, and status codes. Add structured logging to database operations |

---

## Unconfirmed Issues

**None identified.** All findings are supported by direct code inspection.

---

## Summary

### Strengths

1. **Parameterized queries throughout** — Both `listOrders()` and `createOrder()` use PostgreSQL parameterized queries (`$1`, `$2`), preventing SQL injection. This is correctly applied consistently across the codebase.

2. **Input validation at application boundary** — The POST `/orders` endpoint validates the presence and type of `customerId` and `totalMinor` before passing to the database, demonstrating boundary-layer validation discipline.

3. **Clear, minimal codebase** — The service is intentionally small and focused. Entry point (`app.js`) is readable; database layer (`orders.js`) is straightforward; no unnecessary abstraction layers.

4. **Test coverage for formatting logic** — The `formatMinor` function has test coverage, showing test-first thinking for utility functions.

### Key Risks

**Critical Reliability Issue (Finding #1):** Unhandled database errors will crash request handlers. A query failure leaves clients without a response. This is the most urgent fix.

**High Data Safety Concerns (Findings #4, #5):** The nightly retention job deletes 90 days of order data with no backup verification or logging. The backup restore check has been disabled for 4 months. If retention or backups fail, data loss occurs with no alert.

**Input Validation Gaps (Findings #2, #6):** While parameterized queries prevent SQL injection, missing validation for undefined `customerId` and negative `totalMinor` creates logical bugs and allows invalid state in the database.

**Dead Code (Finding #3):** `formatMinor` is tested but never used, creating maintenance confusion and wasted test coverage.

### Priority Order

1. **Add error handling to database calls** (Finding #1) — 30 min effort, prevents crashes. Add try-catch to both handlers and return HTTP 500 on failure.

2. **Re-enable and fix backup verification** (Finding #4) — Urgent if retention is already running. Test restore procedure weekly. Add alerts for retention job success/failure.

3. **Add validation for totalMinor range** (Finding #6) — 10 min effort. Prevent negative/zero amounts from being persisted.

4. **Validate customerId at GET /orders** (Finding #2) — 10 min effort. Return 400 for missing customerId rather than silently querying with NULL.

5. **Add observability to retention workflow** (Finding #5) — Logging, error exit codes, and notifications. Prevents silent failures.

6. **Resolve formatMinor status** (Finding #3) — If it's not used, delete it and its test. If it's planned, add the endpoint now or document the roadmap.

7. **Implement graceful shutdown** (Finding #7) — Pool cleanup on process termination to prevent connection leaks.

8. **Add request and database logging** (Finding #8) — Low priority but essential for production debugging.

### Coverage Gaps

- **Automated test execution:** Test suite was not executed; code inspection only confirms test file syntax is valid.
- **Dependency security audit:** npm audit was not run; no known vulnerabilities were checked against the dependency tree (express ^4.19.0, pg ^8.11.0).
- **Database schema:** Prior migrations (0001, 0002, 0003) were not examined; table structure assumed based on query analysis.
- **Production deployment:** No visibility into how the app is deployed, scaled, monitored, or how secrets are managed.
- **Load testing:** No performance or concurrency testing performed; behavior under high load is unknown.
- **Integration tests:** No test coverage of the actual endpoints against a real database.
- **Backup restoration testing:** Backup verification script is disabled; restore procedure has not been validated.

---

## What I Verified

- Read all source files (`app.js`, `orders.js`, `format.js`, test file) to check correctness, error handling, and input validation
- Examined test coverage for format utility and identified untested application logic
- Analyzed database queries for SQL injection risks and parameterization
- Reviewed retention workflow (`retention.yml`) and migration (`0004_orders_retention.sql`) for data safety and backup strategy
- Checked operational scripts (`restore-check.sh`) and found backup verification disabled since May 2026
- Confirmed input validation approach for both GET and POST endpoints
- Identified resource lifecycle management (database connection pooling) and shutdown concerns
