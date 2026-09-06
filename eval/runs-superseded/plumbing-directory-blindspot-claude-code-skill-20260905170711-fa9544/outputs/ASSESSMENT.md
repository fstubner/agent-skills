# Engineering Assessment: Orders API

## Scope

**In Scope:**
- `src/` — Main application code (Express app, database layer, formatting utilities)
- `test/` — Test suite
- `migrations/` — Database migrations and retention policy
- `scripts/` — Operational scripts
- `.github/workflows/` — CI/CD automation
- `package.json`, `README.md` — Configuration and documentation

**Out of Scope:**
- `.agent-input/` — Assessment framework reference (not application code)
- Evaluation cases, graders, or expected answers (per instructions)
- Production deployment metrics or logs
- External system integrations beyond what's declared in code

**Depth:** Targeted — all in-scope files read in full, automated checks run, code reading for correctness/security/reliability concerns.

---

## Environment

**Language & Runtime:**
- JavaScript (Node.js ES modules, `"type": "module"` in package.json)

**Framework & Libraries:**
- Express.js ^4.19.0 (web framework)
- pg ^8.11.0 (PostgreSQL client)

**Domain:**
- REST API for orders service
- Two endpoints: list customer orders, place new order
- PostgreSQL backend

**Build & Test Tooling:**
- npm for dependency management
- Node.js native `test` module for unit tests
- No build step (plain JavaScript)

---

## What I Ran

| Command            | Status | Output |
|--------------------|--------|--------|
| `npm test`         | ✔ Pass | 1 test passed (formatMinor utility), duration 101.6ms |
| `npm run build`    | N/A    | No build script defined in package.json |
| `npm run lint`     | N/A    | No lint script defined in package.json |
| `npm audit`        | Not run | Requires approval; node_modules not present in workspace |
| `node src/app.js`  | Not tested | Would require DATABASE_URL env var and PostgreSQL instance |

---

## Findings Table

| # | Severity | Area          | Finding | Evidence | Recommendation |
|---|----------|---------------|---------|----------|-----------------|
| 1 | High | Reliability | Unhandled promise rejection in `listOrders` endpoint | `src/app.js:7` — `await listOrders(...)` has no error handler; if pool.query fails (database down, network error, invalid SQL), the error propagates uncaught | Add try/catch in the route handler or use Express error middleware to catch and return a 500 response |
| 2 | High | Reliability | Unhandled promise rejection in `createOrder` endpoint | `src/app.js:12` — `await createOrder(...)` has no error handler; database errors crash the endpoint | Add try/catch in the route handler; return 500 response if order creation fails |
| 3 | High | Reliability | No error handling in `listOrders` query | `src/orders.js:6` — `pool.query()` can fail if database is unavailable or connection pool is exhausted; error is not caught | Wrap in try/catch, log error, and propagate to caller (app.js) for HTTP response |
| 4 | High | Reliability | No error handling in `createOrder` query | `src/orders.js:12` — `pool.query()` can fail; INSERT operations may fail due to constraint violations or connection issues without proper handling | Wrap in try/catch, distinguish constraint violations (400) from transient errors (500) |
| 5 | Medium | Correctness | Insufficient input validation on `GET /orders` | `src/app.js:7` — Only checks if `customerId` exists (truthy); does not validate type (must be numeric or correct format). POST endpoint validates `Number.isInteger()` for `totalMinor` but GET does not validate `customerId` type | Add type/format validation for `customerId` in GET handler; ensure consistency with POST validation |
| 6 | Medium | Reliability | No validation that `createOrder` returns a result | `src/orders.js:15` — Returns `rows[0]` without checking if `rows` exists or is non-empty. If INSERT succeeds but returns no rows (edge case), returns `undefined` | Check `rows.length > 0` before returning; throw or return error if no rows |
| 7 | Medium | Data Integrity | Backup restore script is disabled and untested | `scripts/restore-check.sh:4` — Script exits with code 0 (success) without running any checks; comment indicates CI timeouts disabled the verification on 2026-05-02 | Re-enable backup restore verification; optimize fixture database or CI timing; confirm data recovery works end-to-end |
| 8 | Medium | Maintainability | Minimal test coverage on critical paths | `test/orders.test.js` — Only 1 test covering `formatMinor()` utility; no tests for `listOrders()`, `createOrder()`, or HTTP endpoints; no error case testing | Add integration tests for both endpoints; test error scenarios (database unavailable, invalid input, constraint violations) |
| 9 | Low | Reliability | Database connection pool is never explicitly closed | `src/orders.js:3` — `pool` is created but no `.end()` or shutdown handler registered; connections may not close cleanly on process exit | Add graceful shutdown handler: register `process.on('SIGTERM', () => pool.end())` or similar in app.js |

---

## Unconfirmed Issues

**No unconfirmed issues.** All findings listed above are based on direct code inspection and are confirmed.

---

## Summary

### Strengths

1. **SQL injection protection is properly implemented** (`src/orders.js:6, 12`) — All database queries use parameterized queries with `$1`, `$2` placeholders, preventing injection attacks regardless of input.

2. **Input validation enforced at the boundary** (`src/app.js:9-10`) — The POST `/orders` endpoint validates that `customerId` exists and `totalMinor` is an integer before passing to the database layer, applying defense-in-depth at the HTTP boundary.

3. **Clean separation of concerns** — HTTP routing (app.js) and data access (orders.js) are cleanly separated into distinct modules, with formatting utilities isolated in format.js.

### Key Risks

**Critical reliability gap:** All database operations (items #1-4) lack error handling. Any database failure—connection timeout, query error, pool exhaustion—will crash the endpoint, causing the service to return an unhandled 500 or worse. This is the highest-priority issue.

**Data recovery untested (item #7):** The backup restore verification is disabled. Without running end-to-end restore tests, data recovery cannot be confirmed to work in production.

**Incomplete validation (item #5):** The GET endpoint does not validate `customerId` type, creating an inconsistency with the POST endpoint and potential unexpected behavior.

### Priority Order

1. **Add error handling to app.js routes** (#1, #2) — Wrap `listOrders()` and `createOrder()` calls in try/catch; return appropriate HTTP 500 responses on database errors. *Impact: Prevents crashes on database failures. Effort: 15 min.*

2. **Add error handling to orders.js queries** (#3, #4) — Wrap `pool.query()` calls in try/catch; propagate errors to caller or handle specific cases (constraint violations, transient errors). *Impact: Enables endpoint-level error handling. Effort: 15 min.*

3. **Validate `customerId` type in GET endpoint** (#5) — Add type/format check matching POST validation (e.g., `Number.isInteger()` if customer IDs are numeric). *Impact: Consistency and correctness. Effort: 5 min.*

4. **Check INSERT result before returning** (#6) — Validate `rows.length > 0` before accessing `rows[0]`. *Impact: Prevents undefined responses. Effort: 5 min.*

5. **Re-enable and fix backup restore verification** (#7) — Diagnose CI timeout, optimize fixture size or test timeout, re-enable `scripts/restore-check.sh`. *Impact: Confirms data recovery works. Effort: 30–60 min (depends on fixture size).*

6. **Add integration tests for endpoints** (#8) — Write tests for both GET and POST routes, including error cases. *Impact: Catches regressions, documents expected behavior. Effort: 45 min.*

7. **Add graceful shutdown handler** (#9) — Register SIGTERM handler to close pool cleanly. *Impact: Clean connection closure on exit. Effort: 5 min.*

### Coverage Gaps

- **No npm audit run** — Dependency vulnerabilities not audited (node_modules not present in assessment workspace). Recommend running `npm audit` in CI and using `npm audit fix` or pinning versions if known vulnerabilities exist.
- **No load/stress testing** — Performance characteristics of the query paths are not measured; N+1 risks or timeout behaviors under load are untested.
- **No database schema inspection** — The schema itself (table structure, constraints, indexes) is not examined; referential integrity, uniqueness constraints, or query performance implications are inferred only from migration files.
- **No integration test with real PostgreSQL** — The orders endpoints are not tested against an actual database; edge cases like connection failures, constraint violations, or race conditions are not validated.
- **No production metrics** — Error rates, latency, backup restore success rates, and retention workflow execution are not visible; operational health cannot be assessed.
- **No authentication/authorization** — The assessment assumes this service is protected at a higher layer (API gateway, proxy); no auth is implemented in the service itself and its necessity is not determined here.

---

## What Was Verified

✓ All source files examined (app.js, orders.js, format.js, orders.test.js)  
✓ All migration files inspected (0004_orders_retention.sql)  
✓ CI/CD workflow reviewed (.github/workflows/retention.yml)  
✓ Configuration and build scripts verified (package.json, scripts/)  
✓ Test suite executed successfully (1 passing test)  
✓ Parameterized queries confirmed throughout  
✓ Input validation strategy assessed  
✓ Error handling gaps identified  
✓ Data retention and backup procedures documented  
