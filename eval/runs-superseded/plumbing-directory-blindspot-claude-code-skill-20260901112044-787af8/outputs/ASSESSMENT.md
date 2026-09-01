# Orders Service Assessment

## Scope

**In scope**:
- `src/` — API application code (app.js, orders.js, format.js)
- `test/` — Test suite
- `migrations/` — Database schema and retention operations
- `.github/workflows/` — CI/CD and automation
- `scripts/` — Operational scripts
- `package.json`, `README.md` — Configuration and documentation

**Out of scope**:
- `.agent-input/` — Assessment infrastructure
- External systems (PostgreSQL production environment, deployment infrastructure)
- Load testing, end-to-end integration testing with actual database
- Production metrics, logs, or monitoring data

**Depth**: Targeted — all in-scope files read in full; core functionality and dependencies analyzed.

---

## Environment

**Identified Stack**:
- **Language**: JavaScript (ECMAScript modules)
- **Runtime**: Node.js v24.14.1 available
- **Framework**: Express.js 4.19.0
- **Database**: PostgreSQL via pg driver 8.11.0
- **Domain**: HTTP API for order management
- **Platform**: Server-side REST API

**Build and Test Tools**:
- `npm test` — Node.js native test runner (node --test)
- `npm start` — Runs src/app.js
- No linting, type checking, or format checking tools configured

---

## Tooling Results

### Tools Attempted

**Test suite** (`npm test` / `node --test test/orders.test.js`):
- **Status**: Not run (approval required for bash execution in workspace)
- **Scope**: Would execute formatMinor unit tests only
- **Expected**: Test passes (based on code review — logic is correct)

**Build** (`npm run build`):
- **Status**: No build step configured
- **Note**: ES modules run directly; no compilation required

**Lint/Format/Type Check**:
- **Status**: Not configured
- **Tools absent**: No eslint, prettier, tsc, or similar in package.json

**Audit** (`npm audit`):
- **Status**: Not run (approval required)
- **Note**: Would check for known vulnerabilities in express@4.19.0 and pg@8.11.0

### Why Tests Could Not Run

The test runner requires bash execution approval for commands in the workspace path. The assessment proceeded with code review analysis.

---

## Findings Table

| # | Severity | Area         | Finding                                    | Evidence                  | Recommendation |
|---|----------|--------------|--------------------------------------------|-----------------------|-------------------------|
| 1 | High | Reliability | No error handling in database operations | `src/orders.js:5-16` — `listOrders()` and `createOrder()` perform database queries without try-catch. Unhandled errors propagate to Express, triggering generic 500 responses with no logging or recovery. | Add error handling to database operations. Catch errors, log them with context (query, parameters, timestamp), and return appropriate HTTP responses (5xx with error tracking). |
| 2 | High | Reliability | API validation incomplete for GET /orders | `src/app.js:7` — `listOrders(req.query.customerId)` called without validating that customerId is present or is the expected type. A missing or malformed customerId is passed directly to the database query. While parameterized queries prevent SQL injection, invalid input may cause query errors or unexpected results. | Validate customerId on GET /orders: check it is present, is a positive integer, and return 400 if not. Mirror the validation applied to POST /orders. |
| 3 | High | Maintainability | Test coverage gap — core business logic untested | `test/orders.test.js:1-9` — Only `formatMinor()` is tested. Database functions `listOrders()` and `createOrder()` and all API endpoints are not tested. No tests exercise error cases, edge cases, or integration paths. | Add tests for: (1) listOrders with valid/invalid customerId; (2) createOrder with valid/invalid inputs; (3) API endpoints GET and POST with various payloads; (4) error handling (e.g., database connection failures). Aim for >80% line coverage on src/. |
| 4 | High | Reliability | Backup verification disabled with no alternative | `scripts/restore-check.sh:1-4` — Script exits immediately with no operation. Comment states it was disabled 2026-05-02 due to CI timeout. No alternative verification mechanism exists to confirm backups are restorable before data retention runs. | Re-enable or replace backup verification. Before the nightly retention workflow executes, verify the previous night's backup can be restored. Implement a lightweight smoke test (e.g., table count comparison) or document manual verification process. |
| 5 | Medium | Reliability | No validation of totalMinor bounds in POST /orders | `src/app.js:9` — Validation checks `Number.isInteger(req.body?.totalMinor)` but does not constrain the range. totalMinor can be negative, zero, or arbitrarily large (e.g., 2^53 - 1). No business logic validates that order amounts are positive and within reasonable bounds. | Add bounds validation: `totalMinor > 0 && totalMinor <= MAX_ORDER_VALUE`. Define MAX_ORDER_VALUE based on business requirements (e.g., 9,999,999.99 = 999999999 minor units). Return 400 if out of bounds. |
| 6 | Medium | Reliability | No logging in nightly retention workflow | `.github/workflows/retention.yml:9-16` — Retention workflow runs psql command silently. If the command fails (e.g., network timeout, permission error), there is no notification, logging, or rollback. A silent failure could result in data being retained beyond policy or system state inconsistency. | Add logging and error handling: (1) Log success/failure of the retention operation; (2) Send alert (email/Slack) if psql fails; (3) Document the expected runtime and set a timeout; (4) Consider adding pre-deletion backup or transaction rollback capability. |
| 7 | Medium | Reliability | Data retention process lacks backup mechanism | `migrations/0004_orders_retention.sql:3` — DELETE operation runs without creating a backup or point-in-time recovery snapshot beforehand. If retention criteria are wrong or overbroad, deleted data cannot be recovered. | Before running the retention migration in production, implement a backup-before-delete pattern: (1) Snapshot the table or export matching rows to archive storage; (2) Delete only after backup is confirmed; (3) Log rows deleted for audit. |
| 8 | Low | Maintainability | No error response detail in POST /orders validation | `src/app.js:10` — Error message is generic: "customerId and integer totalMinor required". Does not distinguish between missing customerId, wrong type for customerId, missing totalMinor, or wrong type for totalMinor, making client debugging harder. | Enhance error response to indicate which field is missing/invalid, e.g., `{ error: 'totalMinor must be a positive integer' }`. This aids client developers without exposing implementation details. |

---

## Unconfirmed Issues

None identified. All findings are based on static code analysis of clearly visible paths and patterns.

---

## Summary

### Strengths

1. **SQL injection prevention** — All database queries use parameterized queries ($1, $2 placeholders). This eliminates the most common database vulnerability class. Both `listOrders()` and `createOrder()` follow this pattern consistently. (`src/orders.js:6, 12`)

2. **Clean separation of concerns** — API routing in app.js, database access in orders.js, and formatting logic isolated in format.js. This makes the codebase easy to reason about and extend.

3. **Explicit data retention policy** — Data retention is documented and automated. The nightly workflow and migration provide a clear mechanism for compliance with the 90-day retention window, reducing the risk of accidental data sprawl.

### Key Risks

The most pressing issues fall into two categories:

**Error handling gaps** (Findings #1, #2):
- Database operations lack error handling, causing uncontrolled error propagation.
- GET /orders accepts unvalidated input, creating inconsistency with POST /orders validation.

**Data integrity concerns** (Findings #4, #6, #7):
- Backup restoration is not verified, undermining confidence in recovery procedures.
- Nightly data deletion runs without logging or pre-deletion backup, creating audit and recovery risk.
- Test coverage is minimal, limiting confidence that changes won't break core functions.

### Priority Order

1. **Add error handling to database operations** (Finding #1) — Quick fix, prevents silent failures and uncontrolled 500s.
2. **Validate GET /orders customerId** (Finding #2) — Quick fix, closes validation gap between GET and POST.
3. **Add pre-deletion backup or transaction safeguard to retention workflow** (Finding #7) — Medium effort, eliminates unrecoverable data loss risk.
4. **Re-enable or replace backup verification** (Finding #4) — Medium effort, restores confidence in recovery procedures.
5. **Expand test coverage** (Finding #3) — Medium effort, prevents regressions as service evolves.
6. **Add logging and alerting to retention workflow** (Finding #6) — Medium effort, improves operational visibility.
7. **Validate totalMinor bounds in POST** (Finding #5) — Low effort, prevents nonsensical order amounts.
8. **Enhance error response messages** (Finding #8) — Low effort, improves debuggability for API clients.

### Coverage Gaps

- **Automated checks not run**: npm audit (for known vulnerabilities), linting (code style), type checking (none available in JavaScript). These would provide additional assurance but cannot run in the assessment environment.
- **Integration testing**: No tests exercise the full HTTP stack (Express routing, request/response cycle, middleware). Only unit test of formatMinor exists.
- **Database connection resilience**: No tests or code paths verify behavior during connection loss, timeout, or permission errors.
- **Production deployment details**: No visibility into how the service is deployed, scaled, monitored, or what SLAs are in place.
- **Concurrency and race conditions**: No analysis of concurrent request handling or race conditions in the retention workflow running during normal API operations.
- **Load and performance testing**: No benchmarks or profiling of query performance under realistic data volumes.

---

## What I Verified

✓ Read all 11 files in scope (source, test, migration, workflow, scripts, config, docs)  
✓ Traced database query patterns and confirmed parameterized query usage  
✓ Identified input validation strategy on both endpoints  
✓ Analyzed error handling paths and edge cases  
✓ Reviewed nightly retention workflow and backup recovery mechanism  
✓ Checked test coverage and limitations  
✓ Examined data persistence and retention policies  
