# Orders Service Assessment

## Scope

**In Scope**
- `src/` — application code (Express server, order business logic, formatting utilities)
- `test/` — unit test suite
- `migrations/` — database schema and retention policies
- `.github/workflows/` — automated data retention
- `scripts/` — operational utilities

**Out of Scope**
- `.agent-input/` — assessment framework
- `node_modules/` — third-party dependencies

**Depth:** Targeted (all in-scope files read in full; available checks attempted)

---

## Environment

**Language & Runtime:** Node.js (ES modules)  
**Framework:** Express.js (HTTP server)  
**Database:** PostgreSQL (via `pg` client)  
**Domain:** Orders microservice (two REST endpoints for listing and creating orders)  
**Build System:** npm

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | **Requires approval** — approval step blocked command execution. No output available. |
| Code inspection | All source files read and analyzed. |
| Configuration review | package.json, migrations, GitHub workflows reviewed. |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Data Integrity | Missing input validation for `customerId` in GET request | `src/app.js:7` — `listOrders(req.query.customerId)` accepts any value (string, undefined, null, number array) without type checking. No validation that `customerId` is a non-empty integer. | Add explicit validation: `if (!Number.isInteger(Number(req.query.customerId)))` before query, or return 400. |
| 2 | High | Correctness | `formatMinor()` produces incorrect output for edge cases | `src/format.js:4` — Function fails for values like `0` (returns `0.00` as expected, but sign handling is fragile). For negative numbers at boundaries (e.g., `-1`), returns `-0.01` correctly, but relies on Math.floor and modulo which can produce inconsistent results. Example: `formatMinor(0.1)` is passed a float, not an integer, and produces wrong output due to implicit type coercion. | Use `Math.trunc()` instead of `Math.floor()` to handle signs correctly, and add input type validation: `if (!Number.isInteger(totalMinor))`. |
| 3 | High | Reliability | Test suite does not cover API endpoints | `test/orders.test.js` — Tests only `formatMinor()` function in isolation. No tests for GET `/orders`, POST `/orders`, database queries, error cases, or HTTP response codes. | Add integration tests covering: invalid `customerId` (null, undefined, non-integer), malformed request bodies, missing fields, database constraints, and happy-path scenarios. |
| 4 | High | Reliability | Missing error handling in database queries | `src/orders.js:6,11-13` — `pool.query()` calls have no `.catch()` or try-catch. If the database is unavailable, connection pool exhausted, or query fails, the error propagates unhandled to Express, which may crash the worker or leave the connection in a bad state. | Wrap queries in try-catch blocks or add explicit error handling. Return meaningful HTTP error responses (500, 503) to the client. |
| 5 | High | Reliability | No connection pool configuration | `src/orders.js:3` — Pool created with default settings. No explicit `max` connections, `idle` timeout, or `statement_timeout`. Under load, the pool can become exhausted, or long-running queries can block other requests. | Configure pool explicitly: `new pg.Pool({ connectionString: ..., max: 20, idleTimeoutMillis: 30000, statement_timeout: 5000 })`. |
| 6 | High | Data Integrity | Missing constraint validation in POST request | `src/app.js:9-10` — Validation checks for `customerId` and `totalMinor`, but does not enforce: (a) `customerId` is a positive integer, (b) `totalMinor` is non-negative (business logic likely requires non-negative amounts), (c) `totalMinor` is within reasonable bounds (e.g., < 1 billion cents). | Add constraints: `if (totalMinor < 0 \|\| totalMinor > 1e10)` and `if (!Number.isInteger(customerId) \|\| customerId <= 0)`. |
| 7 | Medium | Maintainability | Disabled backup restoration test provides no indication of status | `scripts/restore-check.sh:3-4` — Script disabled in May 2026 with comment "times out in CI" and a bare `exit 0`. No ticket reference, no metrics on fixture size, no alternative monitoring in place. Future readers cannot determine if this is intentional or forgotten. | Create a tracking issue for re-enabling backup tests; document the fixture size and expected runtime; add a temporary TODO comment with the issue link. Alternatively, split the fixture into smaller test cases that don't timeout. |
| 8 | Medium | Architecture | API caller cannot distinguish between "customer not found" and "customer has no orders" | `src/app.js:7` — Both scenarios return `{ "orders": [] }`. If the caller needs to know whether the customer exists (e.g., to display an error vs. "no orders yet"), the API cannot convey this. Combined with missing input validation (#1), a malformed `customerId` also returns empty orders silently. | Return a 400 error if `customerId` is invalid; optionally add a HEAD endpoint or separate "customer exists" check if callers require it. |
| 9 | Medium | Reliability | Retention policy runs at fixed time without monitoring or alerting | `.github/workflows/retention.yml:5-6` — Nightly job runs at 02:00 UTC. No monitoring for failures, no retry logic, no alerting to operations if data deletion fails or takes too long. If the job fails silently, stale data accumulates indefinitely. | Add workflow failure notifications (e.g., Slack, PagerDuty); add a step to log row count before/after deletion; consider adding a manual trigger to test retention separately. |
| 10 | Low | Maintainability | Code imports but never uses `formatMinor` in production | `src/app.js` — The function `formatMinor()` is defined and tested but never called in the orders API. POST endpoint returns raw `totalMinor` from the database, not formatted. Unknown whether frontend is responsible for formatting. | Clarify whether formatting is a backend or frontend concern. If backend should format, use `formatMinor()` in the response. If frontend, document this as an API contract. |

---

## Unconfirmed Issues

**Test execution blocked by approval requirement:** The test command (`npm test`) could not be executed due to system approval barriers. If tests fail, they would reveal:
- Whether the database connection is properly configured in the test environment.
- Whether the `formatMinor()` tests actually pass (the code review suggests they should, but edge cases around type coercion are not fully validated).
- Whether there are any runtime errors in the Express app initialization.

**Connection pool exhaustion under load:** No load testing was performed. The current code uses default pool settings, which may be insufficient for production traffic. Evidence would require:
- Stress tests (e.g., 100+ concurrent requests).
- Monitoring of pool utilization and connection timeouts.

---

## Summary

### Strengths

1. **Parameterized queries:** All database operations in `src/orders.js` use parameterized queries (`$1`, `$2`), eliminating SQL injection risks. ✓
2. **Input validation at boundary:** POST `/orders` validates the presence and type of `customerId` and `totalMinor` in `src/app.js`, before passing to business logic. ✓
3. **Data retention policy in place:** Nightly GitHub workflow automates deletion of orders older than 90 days, with the policy documented in the migration file. ✓

### Key Risks

1. **Unvalidated GET parameter (Critical)** — Finding #1. The `customerId` query parameter in GET `/orders` is not validated, allowing malformed requests to reach the database or return ambiguous empty results. This is the highest priority issue.

2. **Missing error handling for database operations (High)** — Findings #4, #5. Unhandled database errors can crash the service or leave connections in bad states. Query performance is unconfigured, risking resource exhaustion.

3. **Incomplete test coverage (High)** — Finding #3. Tests cover only a utility function, not the API or database integration. The service can ship with latent bugs.

4. **Insufficient input validation on POST (High)** — Finding #6. No bounds checking on `totalMinor` or `customerId`, allowing negative amounts or invalid identifiers to be persisted.

---

## Priority Order

1. **Fix GET `/orders` input validation (Critical)** — Finding #1. Prevent malformed `customerId` from reaching queries. Effort: 10 minutes. Blast radius: all list-order requests.

2. **Add error handling to database queries (High)** — Findings #4, #5. Wrap with try-catch; configure pool limits. Effort: 30 minutes. Blast radius: all API endpoints.

3. **Validate POST `/orders` input bounds (High)** — Finding #6. Reject negative or out-of-bounds totals. Effort: 15 minutes. Blast radius: all order creation requests.

4. **Add integration tests (High)** — Finding #3. Test at least: invalid inputs, error cases, happy path. Effort: 1–2 hours. Blast radius: reliability and maintainability for future changes.

5. **Fix `formatMinor()` type handling (High)** — Finding #2. Replace `Math.floor()` with `Math.trunc()`; validate input is an integer. Effort: 10 minutes. Blast radius: any code using the formatter.

6. **Configure connection pool explicitly (Medium)** — Finding #5. Set `max`, `idleTimeoutMillis`, `statement_timeout`. Effort: 15 minutes. Blast radius: performance and stability under load.

7. **Document backup test status (Medium)** — Finding #7. Add issue tracking or re-enable with smaller fixtures. Effort: 30 minutes. Blast radius: ops team confidence in restore procedures.

8. **Add retention job monitoring (Medium)** — Finding #9. Notify on failure; log row counts. Effort: 30 minutes. Blast radius: data accumulation risk over time.

9. **Clarify `formatMinor()` ownership (Low)** — Finding #10. Document where formatting should happen. Effort: 5 minutes. Blast radius: API contract clarity.

10. **Distinguish empty orders from invalid customer (Medium)** — Finding #8. Return 400 for invalid IDs; 200 with empty array for valid customers with no orders. Effort: 15 minutes. Blast radius: API usability.

---

## Coverage Gaps

**Not Examined:**
- **Load testing:** No performance testing under concurrent load. Pool exhaustion, connection timeouts, and response latencies are unknown.
- **Production deployment:** No review of how the service is deployed (container image, health checks, autoscaling, resource limits).
- **Monitoring and observability:** No review of logging, metrics, alerting, or tracing in place.
- **Authentication and authorization:** No review of how API access is controlled (assumed public endpoint in assessment; if access control exists, it was not visible in code).
- **Database schema (earlier migrations):** Only migration `0004_orders_retention.sql` was reviewed. Schema definition, indexes, and constraints from earlier migrations (`0001`, `0002`, `0003`) are unknown.
- **Package.json dependencies:** No audit run for known vulnerabilities or outdated versions (e.g., `npm audit`).
- **Backup/restore procedure:** The disabled `restore-check.sh` suggests backups exist, but no evidence of backup strategy, RPO, or recovery procedures.
- **Integration with other services:** No review of how the service communicates with other backend systems or the platform.

**Tests not executed:**
- Unit tests (`npm test`) — approval barrier prevented execution. Cannot confirm test pass/fail status.
- Type checking — no TypeScript or flow types; static analysis not possible.
- Linting — no ESLint or other linter output available.
- Format checking — no Prettier or formatter output.

