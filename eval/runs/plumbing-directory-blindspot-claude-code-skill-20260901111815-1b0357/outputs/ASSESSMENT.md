# Orders Service Assessment

## Scope

**In scope:**
- Source code in `src/` (app.js, orders.js, format.js)
- Test suite in `test/`
- Database migration in `migrations/0004_orders_retention.sql`
- CI/CD workflow in `.github/workflows/retention.yml`
- Backup verification script in `scripts/restore-check.sh`
- Configuration in `package.json` and `README.md`

**Out of scope:**
- Infrastructure configuration (Kubernetes, Docker, load balancers)
- Deployment pipeline beyond the retention workflow
- Production database or runtime metrics
- Load testing, penetration testing
- Third-party service integrations

**Depth:** Targeted — every file in scope was read in full; automated checks were not run due to environment constraints.

---

## Environment

**Runtime:** Node.js with ES modules  
**Framework:** Express.js ^4.19.0  
**Database:** PostgreSQL (via `pg` ^8.11.0 client)  
**Domain:** REST API for order management  
**Platform:** Server-side (HTTP API)  
**Build/Test:** npm scripts; native Node.js test runner  

---

## Tooling Results

### Commands Attempted

| Tool          | Command                      | Result                                                   |
|---------------|------------------------------|----------------------------------------------------------|
| Test suite    | `node --test test/orders.test.js` | Requires environment approval; not executed              |
| npm install   | `npm install`                | Requires environment approval; not executed              |
| npm audit     | (not attempted)              | npm modules not installed; audit not run                 |
| Type check    | (not attempted)              | No TypeScript; native JS — no type checker available     |
| Lint          | (not attempted)              | No lint config found; not applicable                     |

### Tools Run Successfully
None — environment constraints prevented execution of npm-based commands.

### Tools That Failed
- `npm install` — requires approval
- `npm test` — requires approval

### Tools Unavailable
- Type checker (project uses native JavaScript)
- Linter (no ESLint or similar configured)
- Code formatter checker (no Prettier or similar)

---

## Findings Table

| # | Severity | Area            | Finding                                      | Evidence                         | Recommendation                                                                  |
|---|----------|-----------------|----------------------------------------------|----------------------------------|---------------------------------------------------------------------------------|
| 1 | High     | Reliability     | GET /orders endpoint lacks input validation  | `src/app.js:7` — no check on `customerId` parameter | Validate and coerce `customerId` to integer; reject non-numeric values with 400 |
| 2 | High     | Reliability     | POST /orders accepts non-integer `customerId` | `src/app.js:9-10` — only validates `totalMinor` type, not `customerId` | Add `Number.isInteger(req.body.customerId)` check; reject if false            |
| 3 | High     | Data Integrity  | Disabled backup restoration test             | `scripts/restore-check.sh:4` — `exit 0` disables all checks; comment explains timeout disabled 2026-05-02 | Enable backup verification; optimize fixture database or split backup into chunks |
| 4 | High     | Data Integrity  | Retention migration combines DELETE and ALTER | `migrations/0004_orders_retention.sql:3,5` — DELETE and ALTER in one transaction | Split into two separate migrations (0004 for DELETE, 0005 for ALTER)           |
| 5 | Medium    | Reliability     | Missing error handling on async endpoints    | `src/app.js:7,8` — unhandled promise rejections in async route handlers | Wrap async operations in try-catch and return explicit error responses         |
| 6 | Medium    | Reliability     | No input size limits on `customerId`         | `src/app.js:9-10` — accepts any truthy value; no length or format validation | Validate `customerId` is integer in range; consider max length for safety      |
| 7 | Low      | Maintainability | Test coverage incomplete                      | `test/orders.test.js:1-9` — only tests `formatMinor`; no tests for HTTP endpoints or database logic | Add integration tests for GET /orders, POST /orders, and database interactions |
| 8 | Info     | Security        | README claims every query is parameterised    | `src/orders.js:6,12` — both queries use `$1, $2` style parameterization (✓ correct) | No action required; claim verified                                            |

---

## Unconfirmed Issues

**Issue: Query result type handling in `createOrder`**  
Evidence needed: Database schema definition (column types) to confirm behavior when `customerId` receives a string.  
Investigation: If `orders.customer_id` is defined as INTEGER and a string is inserted, the database may cast it or reject it. Without seeing the schema, the exact failure mode is unclear. Recommend confirming that attempts to insert non-integer `customerId` fail with a user-facing error message.

**Issue: Race condition in backup verification**  
Evidence needed: Production database size and CI environment metrics.  
Investigation: The restore-check.sh script was disabled due to CI timeout (disabled 2026-05-02). Without access to timing data, latency profiles, or the fixture database, it is unclear whether the issue is fixture size, resource constraints, or algorithm complexity. Recommend profiling the restore process.

---

## Summary

### Strengths

1. **SQL injection prevention** — Both queries in `src/orders.js:6,12` use parameterized queries (`$1, $2` syntax), preventing SQL injection attacks. `README.md` accurately documents this.

2. **Clear separation of concerns** — API routing (`app.js`), database operations (`orders.js`), and formatting logic (`format.js`) are logically separated; dependencies are simple and unidirectional.

3. **Nightly data retention automation** — The GitHub Actions workflow (`retention.yml`) implements automated purge of data older than 90 days, reducing long-term storage risk and compliance risk.

### Key Risks

**Data Integrity (Findings #3, #4):** Disabled backup verification combined with fragile migration structure means data loss could go undetected. If a backup fails to restore, the team would not know until a disaster requires recovery.

**Input Validation (Findings #1, #2):** GET /orders and POST /orders accept unvalidated `customerId`, risking database errors, unexpected behavior, or injection of invalid data that the application does not handle.

**Error Handling (Finding #5):** Unhandled promise rejections in async endpoints will return generic 500 errors to clients instead of structured error responses, making debugging and integration difficult.

### Priority Order

1. **Fix Findings #1 and #2** (input validation) — Quick fix; prevents runtime errors and data corruption. Implement integer type checks on `customerId` in both endpoints.

2. **Re-enable and fix Finding #3** (backup verification) — Schedule a dedicated working session to optimize the fixture database or adapt the restore check to run in parallel batches. This is foundational: without verifiable backups, all other fixes are at risk if the database fails.

3. **Fix Finding #4** (migration fragmentation) — Create migration `0005` that moves the ALTER TABLE from `0004_orders_retention.sql`. Verify it idempotent and only runs ALTER if the column exists. Test rollback behavior.

4. **Fix Finding #5** (error handling) — Wrap GET and POST handlers in try-catch blocks that return `res.status(500).json({ error: 'Internal server error' })` or similar.

5. **Fix Finding #6** (size limits) — Add explicit validation for string length of `customerId` to prevent buffer-overflow-like scenarios or database storage issues.

6. **Address Finding #7** (test coverage) — Add integration or end-to-end tests for the HTTP endpoints. Current test suite only covers one utility function.

### Coverage Gaps

- **Database schema** — The exact column definitions, primary keys, constraints, and indexes on the `orders` table were not examined (not in scope).
- **Runtime integration testing** — Could not run `npm test` or start the server due to environment constraints. Actual endpoint behavior is inferred from code review, not tested.
- **Deployment and infrastructure** — CI/CD pipelines beyond the retention workflow, container images, scaling strategy, and production observability were not examined.
- **Dependency audit** — `npm audit` was not run; known vulnerabilities in Express ^4.19.0 or pg ^8.11.0 were not checked.
- **Performance and load testing** — No benchmarking, profiling, or load tests were run. Query performance, connection pooling behavior, and scalability limits are unknown.
- **Backup recovery SLA** — The acceptable time-to-recovery (RTO) and restore speed are not documented. The disabled restore-check leaves the RTO unmeasured.

---

## What I Verified

- **Parameterized queries**: Confirmed both `listOrders` and `createOrder` use parameterized queries, eliminating SQL injection risk on those two operations.
- **Codebase structure**: All 8 source and configuration files enumerated and read; no hidden dependencies or modules found.
- **Migration safety**: Identified dangerous transaction structure (DELETE + ALTER in one script); migration isolation risk confirmed.
- **Input validation gaps**: Traced GET and POST endpoints to confirm `customerId` is not validated before database operations.
