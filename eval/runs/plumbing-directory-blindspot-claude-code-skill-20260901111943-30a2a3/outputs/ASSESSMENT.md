# Engineering Assessment: Orders API

## Scope

**In scope:**
- `src/` — all application code (Express app, order queries, formatting)
- `test/` — test suite
- `migrations/` — database schema and retention policies
- `.github/workflows/` — deployment and operational automation
- `package.json` — dependencies and scripts

**Out of scope:**
- `.agent-input/` — assessment metadata and evaluation framework
- Production environment configuration, secrets, or operational metrics
- Load testing, penetration testing, or deployment validation
- Database backup/restore procedures beyond what appears in scripts/

**Depth:** Targeted — all files in scope read in full; automated checks attempted.

---

## Environment

**Language and runtime:** Node.js with ES modules (Node 18+)

**Framework:** Express.js 4.19.0

**Database:** PostgreSQL via pg driver 8.11.0

**Testing:** Node.js built-in test framework (node --test)

**Build system:** npm scripts

**Domain:** Web API service (REST endpoints for order management)

**Platform:** Server-side application

---

## What I Ran

### Commands Attempted

| Command | Status | Output |
|---------|--------|--------|
| `node --test test/orders.test.js` | Awaiting approval | Test command requires approval to execute |
| `npm test` | Requires npm install | Dependencies not installed in workspace |
| Type checking (tsc, node) | Not available | No TypeScript or type-checking config found |
| Linting (eslint) | Not available | No eslint configuration present |
| Build (npm run build) | No build script | Package.json defines no build script |
| Dependency audit (npm audit) | Requires npm install | Dependencies not installed in workspace |

**Note:** The test suite exists and is executable via `node --test test/orders.test.js`, but requires user approval. The assessment proceeds with code analysis of all source files and tests without executing the test suite. Command output cannot be pasted since execution was not approved.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | Unhandled Promise rejections in API endpoints | `src/app.js:7,12` — async handlers lack try-catch; database errors propagate as unhandled rejections | Wrap endpoints in try-catch blocks; return 500 status on database errors |
| 2 | Critical | Data Integrity | Missing initial database schema | `migrations/0004_orders_retention.sql` is a retention/cleanup migration but no 0001/0002/0003 files exist; `src/orders.js` queries assume `orders` table exists | Create migration 0001_create_orders_table.sql with full schema including id, customer_id, total_minor, placed_at columns |
| 3 | High | Reliability | No database connection validation at startup | `src/orders.js:3` — pool created without error handling; invalid DATABASE_URL or unreachable database causes silent failure or runtime crash | Add connection test on app startup; fail fast if database is unreachable |
| 4 | High | Correctness | Incomplete input validation for customerId | `src/app.js:9` — checks `req.body?.customerId` exists but doesn't validate it's a number; could be string or any type | Add `Number.isInteger(req.body.customerId)` check; reject non-integer customer IDs |
| 5 | High | Reliability | Test suite incomplete | `test/orders.test.js` tests only `formatMinor`; no tests for API endpoints or database queries | Add tests for GET /orders, POST /orders endpoints; add tests for listOrders and createOrder functions |
| 6 | Medium | Reliability | Database pool not configured | `src/orders.js:3` — pg.Pool created with only connectionString; no idle timeout, max connections, or timeout settings | Explicitly configure pool: `max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000` (adjust for your SLA) |
| 7 | Medium | Reliability | GitHub retention workflow lacks error handling | `.github/workflows/retention.yml:16` — psql command runs without checking exit code or verifying rows deleted | Add error checking: `set -e` or explicit `&& echo "Success"` checks; verify DELETE count |
| 8 | Medium | Maintainability | No request/query logging | All endpoints and database queries execute silently; no instrumentation for debugging production issues | Add structured logging using winston or pino; log request method/path, query duration, result counts |
| 9 | Medium | Maintainability | Migration history incomplete and unclear | Only migration 0004 visible; no explanation of why 0001–0003 are absent; column `legacy_reference` dropped without documentation | Document migration lineage; add comments to 0004 explaining what 0001–0003 did or why they're removed |
| 10 | Medium | Architecture | No graceful shutdown handling | App listens on port but has no shutdown hook for closing database pool | Add `process.on('SIGTERM', ...)` and `process.on('SIGINT', ...)` to drain pool and close connections |
| 11 | Low | Reliability | No validation of totalMinor bounds | `src/app.js:9` checks `Number.isInteger` but no validation that value is positive or within reasonable limits | Validate `totalMinor > 0` and `totalMinor < 999999999` (or appropriate business limit) |
| 12 | Low | Maintainability | No API documentation | No documentation of request/response schemas, error codes, or endpoint behavior | Add JSDoc comments to endpoints and functions; consider OpenAPI/Swagger spec if used by multiple teams |

---

## Unconfirmed Issues

None. All findings above are based on direct code examination of documented functionality.

---

## Summary

### Strengths

1. **Secure query practices** — All database queries use parameterized statements (`:$1, $2, now()`), eliminating SQL injection risk. Queries in `src/orders.js` demonstrate correct pg driver usage.

2. **Input validation at boundary** — Express middleware validates request shape (`customerId` and `totalMinor` presence) before reaching business logic, reducing surface for malformed requests.

3. **Retention policy automation** — GitHub workflow automates nightly data cleanup, removing manual operational burden. Migrations are version-controlled alongside code.

### Key Risks

**Critical:** The application has no error handling for database failures (Findings #1, #3) and lacks the initial schema definition (Finding #2). Together, these mean: (a) any database error will crash the server with an unhandled rejection, and (b) there is no documented way to bootstrap the schema. These must be fixed before production use.

**High:** Input validation is incomplete (Finding #4), allowing non-integer customer IDs to reach the database layer. The test suite does not cover the actual API endpoints (Finding #5), so deployed code has zero evidence of correctness.

### Priority Order

1. **Create migration 0001_create_orders_table.sql** — Without this, the service cannot be deployed or recovered. This blocks deployment.
2. **Add error handling to API endpoints** (try-catch in `src/app.js`) — Prevents crashes from database failures.
3. **Add customerId validation** — Ensure only integer customer IDs reach the database.
4. **Add test coverage for endpoints** — Validate listOrders and createOrder work end-to-end.
5. **Configure database pool** — Set explicit timeouts and connection limits for production stability.
6. **Add logging** — Enable production debugging and monitoring.
7. **Add database startup validation** — Fail fast if database is unreachable.
8. **Fix GitHub workflow error handling** — Ensure retention job reports failure if queries fail.
9. **Document migration history** — Explain why earlier migrations are absent.
10. **Add graceful shutdown** — Cleanly close database connections on process termination.

### Coverage Gaps

**Not examined:**
- Production environment configuration (DATABASE_URL source, PORT, secrets management)
- Deployment automation (how the app is started, updated, monitored in production)
- Load testing, performance profiling, or query optimization (no query logs or timing data available)
- Integration with the wider platform (how orders are consumed by other services, authentication/authorization if required)
- Backup and recovery procedures (restore-check.sh is disabled; no backup strategy visible)
- Monitoring, alerting, or observability setup (no metrics, tracing, or error tracking visible)
- Network security (HTTPS/TLS configuration, CORS, rate limiting)
- API contract documentation (no OpenAPI spec, no versioning strategy)

**Tools that could not be run:**
- Test suite (`node --test test/orders.test.js`) — requires approval
- npm audit — dependencies not installed
- TypeScript type checking — not a TypeScript project
- Linting — no eslint or other linter configured
