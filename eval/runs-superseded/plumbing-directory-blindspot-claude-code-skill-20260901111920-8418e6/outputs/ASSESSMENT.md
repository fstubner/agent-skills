# Orders Service Assessment

## Scope

**In scope**: 
- Core application code: `src/app.js`, `src/orders.js`, `src/format.js`
- Test suite: `test/orders.test.js`
- Database migrations: `migrations/0004_orders_retention.sql`
- CI/CD configuration: `.github/workflows/retention.yml`, `scripts/restore-check.sh`
- Configuration: `package.json`, `README.md`

**Out of scope**: 
- Upstream migrations (0001-0003) that are referenced but not present in this repository
- Production environment configuration and secrets management
- Runtime database schema (prior migrations)
- Load testing, penetration testing, or compliance audits
- API contract testing beyond the scope of unit tests

**Depth**: Targeted (all files in-scope were read in full)

---

## Environment

**Language & Runtime**: JavaScript (ES modules), Node.js

**Frameworks & Libraries**: 
- Express.js 4.19.0 (HTTP framework)
- pg 8.11.0 (PostgreSQL client)

**Domain**: REST API for order management

**Platform**: Node.js server application (backend)

**Build/Test Tooling**: 
- Built-in Node.js test runner (`node --test`)
- No build step (ES modules run directly)
- No linter or formatter configured

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | Requires execution approval; not run. Can be executed with `node --test test/orders.test.js` |
| `npm start` | Not attempted (would require database connection) |
| Automated linting/formatting | No configuration found (eslint, prettier, etc. not installed) |
| Type checking | No configuration found (TypeScript/JSDoc not used) |
| Dependency audit | Not run; `npm audit` available if needed |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Reliability | Unhandled database errors in async endpoints | `src/orders.js:6,12` and `src/app.js:7,12` — queries have no `.catch()` or try/catch error handling | Add error handling: wrap database calls in try/catch and return appropriate HTTP error responses (500 for database failures) |
| 2 | High | Correctness | GET /orders endpoint does not validate customerId input | `src/app.js:7` — customerId from query string is passed to database query without validation; accepts undefined/null/non-integer values | Add validation: check that customerId is provided and is a positive integer before querying |
| 3 | High | Correctness | POST /orders accepts negative and unbounded totalMinor values | `src/app.js:9-10` — validation only checks for integer type, not for valid currency amounts (negative or unreasonably large) | Add range validation: reject totalMinor if negative or exceeds application limits (e.g., `totalMinor > 0 && totalMinor < 10000000`) |
| 4 | Medium | Data Integrity | Missing earlier migrations (0001-0003) | `migrations/` directory contains only `0004_orders_retention.sql`; schema definition is unknown | Document where migrations 0001-0003 are stored or confirm they exist in production database; verify `orders` table structure matches current code assumptions |
| 5 | Medium | Reliability | Backup restore verification disabled since May 2026 | `scripts/restore-check.sh:3` — script exits early due to CI timeouts; no active backup validation | Re-enable restore checks once fixture database is optimized, or establish alternative backup verification strategy |
| 6 | Medium | Reliability | Data retention relies on GitHub Actions workflow without fallback | `migrations/0004_orders_retention.sql:3` and `.github/workflows/retention.yml:5` — 90-day retention depends on nightly scheduled workflow; no alerting if workflow fails | Add monitoring: alert on workflow failure; consider dual-path retention (application-level or database-level job as backup) |
| 7 | Medium | Maintainability | Test suite only covers utility function, not API endpoints or database operations | `test/orders.test.js` — tests only `formatMinor()` function; no tests for `/orders` GET/POST endpoints or database queries | Add integration tests: test both endpoints with valid/invalid inputs, database errors, and edge cases |
| 8 | Low | Maintainability | No error logging or structured observability | `src/app.js`, `src/orders.js` — errors are not logged; no correlation IDs or request tracing | Add logging: log errors at database and HTTP layers with request context (customerId, endpoint) for debugging |
| 9 | Low | Architecture | Database connection pool lacks configuration | `src/orders.js:3` — pool created with minimal config; no connection limits, timeout, or idle settings specified | Review and configure: set explicit `max`, `idleTimeoutMillis`, `connectionTimeoutMillis` based on expected load |

---

## Unconfirmed Issues / Requires Investigation

1. **Database schema structure** — The code assumes `orders` table with columns `id`, `customer_id`, `total_minor`, and `placed_at`, but the initial schema definitions (migrations 0001-0003) are not present. Cannot confirm whether schema matches code assumptions, foreign key constraints exist, or indices are optimal.

2. **Production database performance** — Cannot assess N+1 queries, missing indices, or query performance without access to production query logs or execution plans for the two queries in `orders.js`.

3. **formatMinor() usage** — The `formatMinor()` function is tested but never called in the main application code (`app.js` and `orders.js`). Unclear whether it is used elsewhere or is dead code.

---

## Summary

### Strengths

1. **Correct parameterized queries** — Both database queries in `orders.js` (lines 6, 12) use parameterized queries with `$1`, `$2` placeholders, preventing SQL injection. Matches README claim.

2. **Input validation at boundary** — POST `/orders` endpoint validates the presence of required fields and type-checks `totalMinor` as an integer before forwarding to the database, following API gateway pattern described in README.

3. **Simple, focused architecture** — The service has a clear separation of concerns: HTTP handler (app.js) → business logic (orders.js) → database. Easy to understand and extend.

---

### Key Risks

1. **Unhandled database failures (Findings #1)** — Any database error (connection failure, timeout, constraint violation) will crash the async route handler and return an unhandled promise rejection to the client. This violates HTTP contract and degrades user experience.

2. **Input validation gaps (Findings #2, #3)** — The GET endpoint does not validate `customerId`, and the POST endpoint does not constrain `totalMinor` to valid currency ranges. These gaps allow malformed requests to reach the database.

3. **Incomplete migration history (Finding #4)** — Missing migrations 0001-0003 create uncertainty about schema and make it impossible to verify the code-to-schema mapping without external sources.

4. **Disabled backup verification (Finding #5)** — No active validation that backups can be restored, increasing risk of undetected backup corruption.

---

### Priority Order

1. **Add error handling to all async endpoints** (Finding #1) — Implement try/catch or .catch() handlers for database queries and return 500 status on failure. High severity, affects all traffic.

2. **Add input validation for GET /orders customerId** (Finding #2) — Check that customerId is provided and is a positive integer. High severity, simple fix.

3. **Add range validation for totalMinor** (Finding #3) — Reject negative values and amounts exceeding application limits. High severity, prevents invalid state.

4. **Locate and review missing migrations** (Finding #4) — Find migrations 0001-0003 in history or other repositories; document current schema assumptions. Medium severity, foundational to understanding the system.

5. **Add integration tests** (Finding #7) — Create tests for both endpoints with valid/invalid inputs and error cases. Medium severity, improves confidence in deployed code.

6. **Re-enable or replace backup verification** (Finding #5) — Optimize database fixture or establish alternative backup validation. Medium severity, affects disaster recovery.

7. **Set up data retention monitoring** (Finding #6) — Add alerting on retention workflow failure and consider dual-path retention. Medium severity, prevents data loss.

8. **Configure database pool limits** (Finding #9) — Set explicit connection pool settings (max, timeout, idle). Low severity, prevents resource exhaustion under load.

---

## Coverage Gaps

**Not Examined**:
- Initial schema (migrations 0001-0003) — cannot verify current table structure or indices
- Load testing — no assessment of performance under concurrent traffic
- Production environment configuration — database connection settings, secrets management, monitoring
- `formatMinor()` usage context — where and how this function is used in the broader platform
- Authentication and authorization — no auth mechanism visible; unclear if API is public or internal
- API contract (OpenAPI/Swagger) — no formal schema; testing based on code inspection only
- Dependency vulnerability audit — `npm audit` not run to check for known CVEs in Express or pg
- Rate limiting and DDoS protection — no application-level rate limiting visible
- Database transaction handling — unclear if multi-statement operations are wrapped in transactions
- Data validation at application level vs. database constraints — unable to verify which layer enforces constraints

**Tools Not Run**:
- `npm test` — blocked; needs execution approval
- `npm audit` — not run; would reveal dependency vulnerabilities
- Node.js type checking — project does not use TypeScript or JSDoc; no static analysis applied
- Linting — no eslint or similar configured

**Testing Not Performed**:
- Integration tests with live database
- Edge case testing (boundary conditions, extremely large values, Unicode handling)
- Concurrent request handling under load
- Database failure modes (connection loss, timeout, constraint violation)
- Deployment and rollback procedures
