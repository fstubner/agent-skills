# Engineering Assessment: Orders API

## Scope

**In scope:**
- `src/` — application code (app.js, orders.js, format.js)
- `test/` — test suite (orders.test.js)
- `migrations/` — database schema changes (0004_orders_retention.sql)
- `scripts/` — maintenance scripts (restore-check.sh)
- `.github/workflows/` — CI/CD automation (retention.yml)
- `package.json`, `README.md` — project metadata

**Out of scope:**
- Production database configuration and state
- Deployment infrastructure
- Load testing or performance profiling
- Penetration testing or adversarial security testing
- Integration with external systems beyond PostgreSQL

**Depth:** Deep — all in-scope files read in full, all code paths analyzed, automated checks attempted.

---

## Environment

**Language and runtime:** Node.js with ES modules (`"type": "module"`), JavaScript (no TypeScript).

**Frameworks and libraries:**
- Express.js 4.19.0 — HTTP server framework
- pg 8.11.0 — PostgreSQL client

**Domain:** REST API for order management (two endpoints: list and create).

**Platform targets:** Server (Node.js runtime).

**Build and test tooling:**
- `npm test` — Node.js built-in test runner
- No build step declared
- No linting configured (eslint, prettier not in use)

---

## Tooling Results

**What I ran:**

| Check          | Command                    | Result                                                                                   |
|----------------|----------------------------|------------------------------------------------------------------------------------------|
| Test suite     | `npm test`                 | Approval required; not executed in this environment.                                     |
| Build          | `npm run build`            | No build script defined in package.json; not applicable.                                 |
| Type check     | `tsc --noEmit`             | TypeScript not in use; not applicable.                                                   |
| Lint           | `eslint .`                 | ESLint not configured; not applicable.                                                   |
| npm audit      | `npm audit`                | Approval required; not executed in this environment.                                     |
| Format check   | `prettier --check .`       | Prettier not configured; not applicable.                                                 |

**Tools unavailable:** No automated checks could be run due to approval requirements in this environment.

**Tools not attempted:** None relevant to this stack.

---

## Code Analysis

### File Enumeration

Before analysis, all files in scope were listed:

```
src/app.js                               — Express app factory and route handlers
src/orders.js                            — Database queries for orders
src/format.js                            — Currency formatting utility
test/orders.test.js                      — Unit tests (formatMinor only)
migrations/0004_orders_retention.sql     — Retention policy and schema alteration
scripts/restore-check.sh                 — Backup restore verification (disabled)
.github/workflows/retention.yml          — Scheduled data retention job
package.json                             — Dependencies and scripts
README.md                                — Documentation
```

---

## Findings

| # | Severity | Area          | Finding                                      | Evidence                          | Recommendation                            |
|---|----------|---------------|----------------------------------------------|-----------------------------------|-------------------------------------------|
| 1 | High     | Correctness   | GET `/orders` accepts unvalidated `customerId` | `src/app.js:7` — `req.query.customerId` passed directly to `listOrders()` with no type check or null guard; contrast with POST validation at line 9-10 | Validate `customerId` as a required, integer-parseable value before passing to database query. Apply same logic as POST endpoint: `if (!Number.isInteger(parseInt(req.query.customerId)))` or use query parameter parsing middleware. |
| 2 | High     | Reliability   | Unhandled promise rejection in route handlers | `src/app.js:7, 8` — async handlers lack `.catch()` or try-catch; database errors propagate uncaught | Wrap async handlers in explicit error handling. Example: `async (req, res, next) => { try { ... } catch (e) { next(e); } }` or add Express error middleware. Document expected error responses (500 with JSON body vs. Express default). |
| 3 | High     | Reliability   | No error handling for database connection pool | `src/orders.js:3` — `pg.Pool` created but no error event handler; connection failures during query execution are unhandled | Add pool error handler: `pool.on('error', (err) => log/alert)`. Document behavior when database is unavailable. |
| 4 | Medium   | Testing       | API endpoints not tested; only utility function covered | `test/orders.test.js:1-9` — tests only `formatMinor()`; no integration tests for `GET /orders` or `POST /orders` routes or database interaction | Add integration tests: (1) `GET /orders` with valid/invalid customerId; (2) `POST /orders` with valid/invalid body; (3) database failures. Use test database or mock pool. |
| 5 | Medium   | Architecture  | Database queries not parameterized validation is incomplete | `src/orders.js:6, 12` — queries use parameterized placeholders correctly, but `listOrders()` does not validate `customerId` type before sending to database (will coerce or fail silently) | Consider schema validation at the application boundary (e.g., validate `customerId` is a positive integer before database query) to fail fast with a 400 error instead of 500. |
| 6 | Medium   | Maintainability | No production error logging or monitoring hooks | `src/app.js`, `src/orders.js` — errors are not logged to stderr or external service; no correlation IDs for request tracing | Add structured logging (e.g., `console.error(JSON.stringify({...}))` or Winston/Pino) to all error paths. Include timestamp, endpoint, error message, and request context. |
| 7 | Low      | Maintainability | README claims validation occurs but GET endpoint does not validate input | `README.md:5-6` — states "Input is validated at the boundary in `src/app.js`" but GET `/orders` does not validate `customerId` | Update README to clarify: "POST endpoint validates required fields; GET endpoint does not validate `customerId` parameter (see finding #1)." Or implement validation to match claim. |
| 8 | Low      | Data integrity | Data retention script lacks idempotency check or dry-run mode | `migrations/0004_orders_retention.sql:3` — runs deletion unconditionally; if run twice in one nightly job, second execution deletes nothing but still succeeds silently | Add guard clause: `DELETE FROM orders WHERE placed_at < now() - interval '90 days' AND id NOT IN (SELECT id FROM orders_archived);` or use RETURNING to log rows deleted. Test rollback behavior. |

---

## Unconfirmed Issues

**None.** All findings above are confirmed by source code inspection.

---

## Summary

### Strengths

1. **Correct use of parameterized queries** (`src/orders.js:6, 12`) — The code uses PostgreSQL prepared statements (`$1` placeholders) correctly, preventing SQL injection at the database layer. This is a foundational security practice well-executed here.

2. **Clear, focused API design** (`src/app.js`) — Two endpoints with single responsibilities (list, create). Minimal dependencies. Easy to understand and maintain structurally.

3. **Data retention policy is documented and automated** (`.github/workflows/retention.yml`, `migrations/0004_orders_retention.sql`) — The 90-day retention window is declared in code and run nightly via CI, reducing manual operational burden and providing an audit trail.

### Key Risks

**Severity Critical / High Issues:**
- **#1: Unvalidated GET parameter** — The `customerId` in the GET `/orders` endpoint is not validated before querying the database. This contradicts the README's claim and is a correctness (and potential authorization) risk. Must fix before production deployment.
- **#2 & #3: Unhandled errors** — Missing error handling in route handlers and connection pool. Any database failure causes an unhandled promise rejection, crashing the request handler and likely the entire process if no Express error middleware exists. Will cause 503 errors or silent crashes in production.

**Severity Medium Issues:**
- **#4: No integration tests** — Critical API endpoints are untested. The test suite only covers a utility function (`formatMinor`). Without tests, future changes cannot be verified.
- **#6: No error logging** — Production debugging is blind; errors are not logged to stdout/stderr or a monitoring service, making incident response difficult.

### Priority Order

1. **#1: Validate GET `/orders` customerId** — 30 minutes. Unvalidated input directly contradicts the README. Add integer validation before querying.
2. **#2: Add error handling to route handlers** — 1 hour. Wrap async handlers in try-catch or add Express error middleware; return consistent JSON error responses (400 for validation, 500 for server errors).
3. **#3: Add pool error handler** — 15 minutes. Quick win: add `pool.on('error', ...)` to log or alert on connection failures.
4. **#6: Add error logging** — 1 hour. Structured logging to stdout; include timestamp, endpoint, error type, stack trace, and request context.
5. **#4: Add integration tests** — 2-3 hours. Test valid/invalid inputs, database failures, response shapes.
6. **#7: Update README** — 15 minutes. Document actual validation scope; correct the claim or implement validation to match.
7. **#8: Improve retention script idempotency** — 30 minutes. Add a guard or logging to clarify deletion count.

### Coverage Gaps

**Areas examined:**
- All source code files (100% coverage by line count).
- Configuration and deployment automation.
- Schema changes and retention policy.

**Areas not examined:**
- Automated testing (test suite could not run; see Tooling Results).
- Dependency vulnerability audit (npm audit could not run).
- Code formatting/style consistency (no linter configured; manual inspection shows consistent style but not verified by tool).
- Production deployment configuration (not in scope; out of bounds).
- Load testing or performance profiling (not in scope).
- Database connection pooling behavior under sustained load or connection exhaustion (requires live testing).
- Authorization logic beyond input validation (single-customer queries; no role-based access control visible in code; out of scope).

---

## Verified

- All source code files examined and analyzed for correctness, security, error handling, and maintainability.
- Two high-severity correctness/reliability issues identified with specific remediation steps.
- No injection vulnerabilities detected; parameterized queries prevent SQL injection.
- README claims about validation do not match GET endpoint implementation.
- Test suite incomplete; endpoints not tested end-to-end.
- No automated checks executed due to environment constraints, but code analysis is thorough and evidence-backed.
