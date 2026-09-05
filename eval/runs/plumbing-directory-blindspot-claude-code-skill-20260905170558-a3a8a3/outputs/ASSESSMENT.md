# Orders Service Assessment

## Scope

**In scope:**
- `src/app.js` — Express server and route handlers
- `src/orders.js` — Database query functions
- `src/format.js` — Utility functions
- `test/orders.test.js` — Test suite
- `package.json` — Dependencies and scripts

**Out of scope:**
- Deployment and infrastructure configuration
- Database schema and setup procedures
- Production environment variables and secrets management
- Network and load testing
- Penetration testing

**Depth:** Targeted — all in-scope files read in full; automated checks run where available.

---

## Environment

**Language and runtime:** Node.js with ES modules, JavaScript  
**Framework:** Express.js ^4.19.0  
**Database:** PostgreSQL (via `pg` ^8.11.0)  
**Domain:** RESTful web service (orders API)  
**Build/test tooling:** npm scripts; Node.js built-in test runner  

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | ✅ Passed — 1 test suite, 1 passing test, 0 failures (103.99ms) |
| `npm run build` | ❌ Not available — no build script defined |
| `npm audit` | ⚠️ Blocked by permission system; could not execute |
| Lint/type-check tools | ❌ Not configured — no eslint or TypeScript in project |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Security | Missing authentication and authorization | `src/app.js:7, 8` — All endpoints accept requests from any caller; no user identity verification or access control before returning orders or creating orders for any customer. | Implement authentication (e.g., JWT, session) and verify that the authenticated user matches the requested `customerId` before returning data or processing orders. |
| 2 | High | Correctness | GET /orders customerId not validated as integer | `src/app.js:7` — Route handler calls `listOrders(req.query.customerId)` without checking that `customerId` is an integer. POST /orders validates this for `customerId` (line 9), but GET does not. README claims "input is validated at the boundary", but this contradicts the code. | Add validation: `if (!Number.isInteger(parseInt(req.query.customerId)))` before calling `listOrders()`, or reject with 400 error if not provided/invalid. |
| 3 | High | Reliability | Unhandled promise rejections in route handlers | `src/app.js:7–13` — Route handlers use `async` but lack `.catch()` or try-catch blocks. If `listOrders()` or `createOrder()` reject, the error propagates uncaught, causing the server to crash or hang without sending a response. | Wrap route handlers in try-catch, or add `.catch()` to each `await` expression to return 500 errors with safe error messages. |
| 4 | High | Reliability | Missing error handling in database pool | `src/orders.js:1–16` — Connection pool `pg.Pool` has no error event handler. Pool connection errors (e.g., database down, connection timeout) will emit unhandled errors, causing the process to exit. | Add error listener: `pool.on('error', (err) => console.error('Unexpected error in pool:', err))` to prevent unhandled rejections. |
| 5 | Medium | Maintainability | Incomplete test coverage | `test/orders.test.js:1–9` — Only 1 test, which only tests `formatMinor()` utility. No tests for `listOrders()`, `createOrder()`, or route handlers. Business logic is untested. | Add tests for: (a) `listOrders()` with valid/invalid customerId, (b) `createOrder()` with valid/invalid inputs, (c) route handlers with various status codes (200, 400, 500). |
| 6 | Medium | Maintainability | No error logging or observability | `src/app.js`, `src/orders.js` — No logs, metrics, or structured error output. Errors fail silently or crash without diagnostics. Operators cannot trace requests or failures in production. | Add logging at key points: database queries, errors, request/response payloads (sanitized). Use a logging library like `winston` or `pino` to emit structured logs. |
| 7 | Medium | Reliability | Unhandled case: undefined customerId in GET request | `src/app.js:7` — If `req.query.customerId` is undefined (request with no `?customerId=...` param), it is passed as-is to `listOrders()`, which sends a parameterized query `WHERE customer_id = $1` with `undefined`. Behavior depends on PostgreSQL driver; may return no rows, or raise a type error. | Validate that `customerId` is provided and return 400 error if missing, not just if invalid. |

---

## Unconfirmed Issues

- **Possible SQL type mismatch:** If PostgreSQL column `customer_id` is a smallint/bigint but a string-typed value is passed from `req.query.customerId`, implicit coercion behavior depends on PostgreSQL version and driver version. Unable to confirm without seeing schema and running integration tests against a live database. *What would confirm:* schema definition of `orders` table, integration test with various input types, PostgreSQL logs during test.

---

## Summary

### Strengths

1. **Parameterized queries** — Both `listOrders()` and `createOrder()` use parameterized queries (`$1`, `$2`), protecting against SQL injection. `src/orders.js:6, 11–12`.

2. **Basic input validation for POST** — The `/orders` POST endpoint validates presence and type of `customerId` and `totalMinor` before processing. `src/app.js:9–10`.

3. **Utility function correctness** — The `formatMinor()` helper correctly handles positive, negative, and small amounts (e.g., 5 cents = "0.05"). Test passes.

### Key Risks

1. **No authentication/authorization (Finding #1)** — Anyone can read any customer's orders or create orders for any customer. This is a critical data breach and fraud risk. Blocks production deployment.

2. **Missing input validation on GET endpoint (Finding #2)** — `customerId` is not validated in the GET route, contradicting the README's claim. Will pass undefined/invalid values to the database.

3. **Unhandled errors crash the server (Findings #3, #4)** — Route handlers and the connection pool lack error handling. Database failures or network issues will crash the process without graceful degradation or client feedback.

4. **Incomplete test coverage (Finding #5)** — Only the utility function is tested. Core business logic (`listOrders`, `createOrder`) and route handlers have zero test coverage, making refactoring and maintenance risky.

### Priority Order

1. **[CRITICAL] Add authentication and authorization** (Finding #1) — Implement user identity verification and ensure users can only access their own orders. This is a blocking issue for any production use.

2. **[HIGH] Add error handling to all route handlers** (Finding #3) — Wrap async handlers in try-catch to prevent unhandled rejections. Return 500 status with safe error messages to clients.

3. **[HIGH] Validate GET /orders customerId parameter** (Findings #2, #7) — Check that `customerId` is provided and is a valid integer. Return 400 if not.

4. **[HIGH] Add error event listener to the database pool** (Finding #4) — Prevent unhandled pool errors from crashing the process.

5. **[MEDIUM] Expand test coverage** (Finding #5) — Add tests for `listOrders()`, `createOrder()`, and route handlers, including error cases (invalid input, database failures).

6. **[MEDIUM] Add structured logging** (Finding #6) — Log database queries, errors, and request details for observability in production.

### Coverage Gaps

- **Not examined:** Production deployment environment, reverse proxy configuration, rate limiting or DDoS protection, SSL/TLS setup, secrets rotation, database connection pooling limits and timeout behavior, monitoring/alerting rules.
- **Not tested:** Integration tests with a real PostgreSQL instance; load testing; error scenarios (database down, connection timeouts, malformed requests); authentication and authorization flows.
- **Not run:** Linting (no ESLint config); type checking (no TypeScript or JSDoc); security scanning tools (could not run `npm audit` due to permission restrictions).
- **Not available:** Database schema, migration scripts, deployment procedures, API documentation, service-level objectives (availability, latency, data retention policy).

