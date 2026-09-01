# Engineering Assessment: Orders API

## Scope

**In Scope:**
- `src/app.js` — Express server and API endpoints
- `src/orders.js` — Database operations (listOrders, createOrder)
- `src/format.js` — Utility functions for formatting
- `test/orders.test.js` — Test suite

**Out of Scope:**
- Deployment configuration and infrastructure
- Production database setup and migration strategy
- Performance testing and load testing
- API authentication/authorization (not implemented)
- External service integrations

**Depth:** Targeted — all in-scope files read in full, code analysis performed.

---

## Environment

**Language & Runtime:** Node.js with ES modules  
**Framework:** Express.js (^4.19.0)  
**Database:** PostgreSQL via pg (^8.11.0)  
**Domain:** REST API service for order management  
**Build System:** npm scripts (start, test)

---

## Tooling Results

**Tools Run:**
- `node --test test/orders.test.js` — Could not run (approval required)
- `npm audit` — Could not run (approval required)
- `npm test` — Could not run (approval required)
- Manual code analysis performed instead

**Impact:** No automated vulnerability or test coverage reports available; findings based on source code review only.

---

## Findings Table

| # | Severity | Area          | Finding                                     | Evidence                                    | Recommendation                                                       |
|---|----------|---------------|---------------------------------------------|---------------------------------------------|----------------------------------------------------------------------|
| 1 | High     | Correctness   | GET /orders missing input validation        | `src/app.js:7` — `customerId` from `req.query` used without validation; undefined/null value would bypass query filter | Add validation: `if (!req.query?.customerId) return res.status(400)...` before calling `listOrders()` |
| 2 | High     | Reliability   | Unhandled database errors in endpoints      | `src/app.js:7,12` — `pool.query()` calls wrapped in `async` but no `.catch()` or try-catch; connection failures, constraint violations not caught | Add error handling: wrap endpoint logic in try-catch and return appropriate HTTP error (500 or 400 for constraint errors) |
| 3 | High     | Reliability   | Unsafe array access in createOrder          | `src/orders.js:15` — `return rows[0]` assumes INSERT always returns a row; no check for empty array if INSERT fails silently | Add check: `if (!rows.length) throw new Error('Insert failed')` before returning `rows[0]` |
| 4 | Medium   | Correctness   | POST /orders accepts non-integer customerId | `src/app.js:9` — Validation checks `Number.isInteger(req.body?.totalMinor)` but not `customerId`; API accepts `{customerId: "abc", totalMinor: 100}` | Add validation: `!Number.isInteger(req.body?.customerId)` to the condition on line 9 |
| 5 | Medium   | Reliability   | Missing DATABASE_URL validation             | `src/orders.js:3` — `process.env.DATABASE_URL` used without checking if it exists; undefined value passed to pg.Pool() | Add check: `if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')` before pool initialization |
| 6 | Medium   | Architecture  | No error boundary for async endpoint handlers | `src/app.js:7,8` — Async route handlers can reject unhandled; Express will send 500 but no structured error logging | Add middleware: `app.use((err, req, res, next) => { console.error(err); res.status(500).json({error: 'Internal error'}) })` |
| 7 | Medium   | Reliability   | Test suite only covers utility functions    | `test/orders.test.js:1-9` — Only `formatMinor()` tested; no tests for `listOrders()`, `createOrder()`, endpoint validation, or error cases | Add integration tests: test both endpoints with valid/invalid inputs, database constraints, missing fields |

---

## Unconfirmed Issues

**Issue: Potential duplicate order race condition**
- **Suspected Problem:** If a client retries a POST /orders request (e.g., timeout), duplicate orders may be created because there is no idempotency key or request deduplication.
- **Why Unconfirmed:** Cannot verify database schema (no migrations/schema file provided); depends on whether `orders.id` is client-provided or auto-generated, and whether duplicate detection is handled elsewhere.
- **Investigation Needed:** Confirm schema, check if application or database layer provides idempotency guarantees.

**Issue: Negative order amounts**
- **Suspected Problem:** `createOrder()` accepts negative `totalMinor` values with no validation, allowing nonsensical orders.
- **Why Unconfirmed:** May be intentional (refunds, credits); business logic not documented in README.
- **Investigation Needed:** Clarify if negative amounts are valid; if not, add `totalMinor > 0` check in `app.js` validation.

---

## Summary

### Strengths

1. **Parameterized queries used correctly** — Both `listOrders()` and `createOrder()` use parameterized queries (`$1`, `$2`), preventing SQL injection. `src/orders.js:6,12` demonstrate proper query construction.

2. **Input validation at boundary** — POST endpoint validates presence of required fields and type of `totalMinor` before passing to database layer. `src/app.js:9-11` shows deliberate validation strategy.

3. **Utility function well-implemented** — `formatMinor()` correctly handles edge cases (negative values, small amounts requiring zero-padding). `src/format.js` is clean and tested.

### Key Risks

**High Severity Issues (Findings #1–3, #6):**
- GET /orders endpoint accepts unvalidated `customerId`, risking data exposure or queries that return unexpected results.
- Database errors (network failures, constraint violations) are not caught, causing unhandled promise rejections and opaque 500 errors to clients.
- Missing array bounds check after INSERT could mask failures or crash the server.
- No error middleware means errors lack context and structured logging.

**Medium Severity Issues (Findings #4–5, #7):**
- Type validation incomplete (non-integer `customerId` accepted).
- Missing environment variable validation at startup.
- Test coverage limited to formatting utility; integration tests absent.

### Priority Order

1. **Add error handling to endpoints** (Findings #2, #6) — Wrap route handlers in try-catch or add error middleware. Highest impact: prevents unhandled rejections and enables structured error responses.
2. **Validate customerId on GET endpoint** (Finding #1) — Add guard clause. Quick fix, medium blast radius.
3. **Validate customerId type on POST endpoint** (Finding #4) — Extend validation condition. Quick fix.
4. **Add array bounds check in createOrder** (Finding #3) — Safety guard for INSERT failures.
5. **Validate DATABASE_URL at startup** (Finding #5) — Fail early with clear error message.
6. **Add integration tests** (Finding #7) — Test endpoints with valid/invalid inputs, database constraints, error scenarios.

### Coverage Gaps

**Not Examined:**
- Database schema and migrations (no schema.sql or migrations/ provided; cannot verify constraint definitions, data types, indexes).
- Production deployment and environment configuration (no .env.example, no docker-compose, no CI/CD pipeline).
- API authentication and authorization (no auth middleware; endpoints are open).
- Load testing, concurrency limits, connection pooling configuration.
- Monitoring, logging, and observability (no logger configured; only console output available).
- Data retention policy (README mentions retention is "handled outside the application" but not verified).

**Tools Not Run (approval required):**
- `npm audit` — Cannot assess dependency vulnerabilities without running.
- Full test suite — Cannot verify test execution and coverage metrics.
- Type checking (no TypeScript; would not apply).

---

## What I Verified

Code review of all source files identified 7 confirmed findings: 3 high-severity issues (missing input validation on GET, unhandled database errors, unsafe array access) and 4 medium-severity issues (incomplete type validation, missing env validation, no error middleware, incomplete test coverage). Parameterized queries prevent SQL injection, and POST input validation is partially implemented. Two unconfirmed issues require investigation (idempotency and negative amounts). Test suite confirmed to cover only utility functions, not integration paths.
