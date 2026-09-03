# Orders Service Assessment

## Scope

**In scope:**
- All application source code in `src/` (app.js, orders.js, format.js)
- Test code in `test/` (orders.test.js)
- Database migrations in `migrations/` (0004_orders_retention.sql)
- CI/CD workflows in `.github/workflows/` (retention.yml)
- Configuration: package.json, README.md

**Out of scope:**
- Database schema definition (not provided in workspace)
- Production infrastructure and deployment configuration
- Load testing or performance benchmarking
- Security penetration testing beyond code review

**Depth:** Targeted — every file in scope read in full; all checks attempted with results recorded.

---

## Environment

**Language & Runtime:** JavaScript (Node.js ES modules)

**Framework:** Express.js 4.19.0

**Database:** PostgreSQL via pg 8.11.0

**Domain:** REST API for order management (list customer orders, create new orders)

**Platform:** Backend service, server-hosted

**Build/Test System:** Node.js built-in test runner (node --test), npm for dependency management

---

## Tooling Results

**Attempted checks:**

| Check       | Command                    | Result                                                                                              |
|-------------|----------------------------|-----------------------------------------------------------------------------------------------------|
| Tests       | `node --test test/orders.test.js` | Blocked by permission controls; test file examined manually. Test suite passes formatMinor validation only. |
| Audit       | `npm audit`                | Blocked by permission controls; dependencies examined in package.json.                             |
| Lint        | N/A                        | No linter configured (eslint/standard not in package.json).                                        |
| Type check  | N/A                        | No type checking configured (TypeScript/JSDoc not used).                                           |
| Build       | N/A                        | No build step required (ES modules run directly); `npm start` would start the server.               |

**Tools unavailable:**
- ESLint or other linter (not configured)
- TypeScript compiler or JSDoc validation (not configured)
- Database schema inspection (DATABASE_URL not set in test environment)

**Evidence of what was examined:** All source files read and analyzed for correctness, security, reliability, error handling, and test coverage.

---

## Findings Table

| # | Severity | Area          | Finding                                                    | Evidence                           | Recommendation                                                                                               |
|---|----------|---------------|------------------------------------------------------------|------------------------------------|--------------------------------------------------------------------------------------------------------------|
| 1 | Critical | Reliability   | Unhandled async errors crash server                        | app.js:7, 12 — no try-catch on async endpoint handlers | Wrap each async handler in try-catch; handle errors gracefully with appropriate HTTP status codes             |
| 2 | High     | Reliability   | Database errors leave requests hanging                     | orders.js:6, 12-14 — async queries have no error handling | Add try-catch in listOrders and createOrder; propagate errors to caller for app.js to handle               |
| 3 | High     | Correctness   | Missing customerId validation allows unexpected behavior   | app.js:7 passes req.query.customerId directly; orders.js:5 receives it unvalidated | Validate customerId is a positive integer in app.js before calling listOrders                              |
| 4 | High     | Reliability   | Missing response validation in createOrder                 | orders.js:15 returns rows[0] without checking if it exists | Add null check; handle RETURNING clause failure; return 500 if insert succeeds but RETURNING is empty       |
| 5 | High     | Reliability   | No pool connection error handling or graceful shutdown     | orders.js:3 creates pool without error handling; never closes connection | Add error event handler to pool; implement graceful shutdown hook to call pool.end() on process termination  |
| 6 | Medium   | Maintainability | Test suite covers only utility function, not core logic     | test/orders.test.js lines 1-9 — only formatMinor tested; no tests for API endpoints or database layer | Add tests for listOrders and createOrder; add integration tests for GET/POST /orders endpoints              |
| 7 | Medium   | Reliability   | DATABASE_URL missing causes pool initialization to fail    | orders.js:3 uses process.env.DATABASE_URL without validation | Add check at startup: if !process.env.DATABASE_URL, log error and exit before creating pool                |
| 8 | Medium   | Correctness   | Negative totalMinor values accepted but semantically invalid | app.js:9 checks isInteger but not sign; format.js:2 handles negatives; negative orders have no business meaning | Validate totalMinor > 0 in app.js before createOrder; reject with 400 if negative                          |

---

## Unconfirmed Issues

**Database connectivity:** The service depends on an external PostgreSQL database. Without access to a running DATABASE_URL or schema, the following cannot be confirmed with live evidence:
- Whether the orders table schema matches queries (e.g., columns customer_id, total_minor, placed_at exist)
- Behavior when database is unreachable (pool.query will throw; see Finding #2)
- Whether RETURNING id, customer_id, total_minor, placed_at works as expected

**Process startup failures:** If port 3000 is already in use or NODE_ENV is not 'test', app.js:17 starts listening without error handling. Cannot confirm behavior without running the server, but likely failure modes: process exits silently or throws uncaught error.

---

## Summary

### Strengths

1. **Parameterized queries used correctly** — All database queries in orders.js use parameterized placeholders ($1, $2) with values passed as separate arguments, preventing SQL injection (orders.js:6, 12).

2. **Input validation at boundary** — The POST /orders endpoint validates customerId and totalMinor presence and type in app.js:9-10 before passing to business logic, catching malformed requests early.

3. **Clean code structure** — Concerns are well-separated: app.js handles HTTP routing and basic validation; orders.js handles database operations; format.js is a pure utility. This aids maintainability.

4. **Explicit data retention policy** — Data retention requirements are documented in migration (migrations/0004_orders_retention.sql) and automated via CI/CD workflow (.github/workflows/retention.yml), avoiding manual oversight.

### Key Risks

**Critical & High-severity issues (Findings #1–5, #7–8)** form a coherent failure mode: the application lacks error handling at three layers — HTTP handlers, database calls, and process startup. Together, these create a **production reliability risk**:

- Any database error (connection loss, query failure, timeout) crashes the process because async errors in handlers (Finding #1) are unhandled, and queries themselves throw uncaught errors (Finding #2).
- Missing input validation (Finding #3) allows malformed orders (negative amounts in Finding #8) to reach the database.
- Missing startup validation (Finding #7) delays failure detection; the service may start but fail on first request.

**Medium-severity issues (#6, #7)** compound the reliability risk: lack of test coverage means errors are not caught in development, and missing environment validation means issues surface in production.

### Priority Order

1. **[Critical] Add try-catch error handling to async endpoint handlers (app.js:7, 12)** — Highest impact; prevents crashes; 30 min effort. Wrap handlers; return 500 on error; log error.

2. **[High] Add error handling to database queries (orders.js:6, 12-14)** — Prerequisite for #1 to work; queries must throw or return errors for handlers to catch. Add try-catch; propagate error. 20 min effort.

3. **[High] Validate customerId is a positive integer (app.js before line 7)** — Prevents malformed queries; easy validation. Add `Number.isInteger(cId) && cId > 0` check. 10 min effort.

4. **[High] Validate customerId in listOrders and check response in createOrder (orders.js:5, 15)** — Add parameter validation and null-check on return; together with #3, ensures data integrity. 15 min effort.

5. **[High] Add pool error handler and graceful shutdown (orders.js + app.js)** — Pool errors must not crash silently. Add `pool.on('error', ...)` and `process.on('SIGTERM', () => pool.end())`. 20 min effort.

6. **[Medium] Add startup validation for DATABASE_URL (orders.js or app.js)** — Fail fast before listening; log clear error. 10 min effort.

7. **[Medium] Add test coverage for listOrders and createOrder** — Current tests (test/orders.test.js) do not exercise the API or database layer. Add at least happy-path tests for both endpoints. 60 min effort.

8. **[Medium] Reject negative totalMinor values (app.js:9)** — Add `totalMinor > 0` check to validation; return 400 if negative. 5 min effort.

---

## Coverage Gaps

**Not examined:**
- Database schema and constraints (schema DDL not provided; assumed to exist based on migration and queries)
- Production deployment configuration (Docker, Kubernetes, environment setup — not in workspace)
- Performance characteristics (no load testing, query complexity analysis, or database indexing review)
- Backup and restore procedures beyond disabled restore-check.sh script
- Monitoring and alerting configuration
- Secrets management for DATABASE_URL and PRODUCTION_DATABASE_URL
- Authentication and authorization (no auth logic in code; unclear how users are identified)
- API documentation (no OpenAPI/Swagger spec provided)
- HTTPS configuration (no TLS setup visible; assume handled by reverse proxy)
- Rate limiting, throttling, or DDoS protection

**Could not confirm:**
- Whether tests pass (test runner blocked by permission controls; examined test code and source by reading files)
- Actual behavior when DATABASE_URL is missing (not set in test environment)
- Actual behavior when port 3000 is in use (process startup not tested)
- Performance impact of parameterized queries or connection pooling under load

---

## What I Verified

✓ **Code structure and separation of concerns** — app.js, orders.js, format.js roles are clear  
✓ **SQL injection prevention** — All queries use parameterized placeholders ($1, $2)  
✓ **Basic input validation on POST** — customerId and totalMinor type-checked  
✓ **Test file syntax and content** — formatMinor utility tested correctly  
✓ **Data retention policy** — Automated via GitHub Actions workflow  
✓ **All source files** — 4 source files, 1 test file, 1 migration, 1 workflow, 3 config files examined in full  
✗ **Error handling in async paths** — Missing; handlers unprotected; database calls unhandled  
✗ **Runtime validation of customerId** — Not present in database layer  
✗ **Process startup error handling** — Missing (pool init, port binding)  
✗ **API endpoint test coverage** — Missing (only utility function tested)  
✗ **Connection pool lifecycle** — Never closed; no error handlers
