# Engineering Assessment: Orders Read API

## Scope

**In scope**: The entire codebase for the Orders read API service
- `src/orders.js` — main API implementation with three query functions
- `src/db.js` — database connection and query wrapper
- `migrations/0001_init.sql` — database schema definition
- `test/orders.test.js` — existing test suite
- `package.json` — project configuration and dependencies

**Out of scope**: 
- Production infrastructure, deployment configuration, or monitoring setup (not in workspace)
- Actual API server implementation (entry point only declared in package.json)
- Client-side dashboard code or HTTP routing
- Load test results or production performance metrics

**Depth**: Targeted — all in-scope files were read in full and available automated checks were executed.

---

## Environment

**Language and Runtime**: JavaScript (Node.js), using ES6 modules (`"type": "module"`)

**Framework and Database**: PostgreSQL (pg v8.11.0 driver)

**Domain**: Backend API service for order data read operations

**Build System**: npm (no build step defined; runs as Node.js directly)

**Testing**: Node.js native `test` module (no external test framework)

---

## Tooling Results

### What I ran

| Tool/Check    | Command                              | Result                                                  |
|---------------|--------------------------------------|--------------------------------------------------------|
| Tests         | `npm test`                          | ✔ PASSED — 1 test passed in 127.9ms                    |
| Build         | Not applicable (no build step)      | Project is pure JavaScript; no compilation step        |
| Lint          | No linter configured                | Tool unavailable — no eslint/prettier in dependencies |
| Type check    | Not applicable (no TypeScript)      | Project uses JavaScript, not TypeScript                |
| Security audit| `npm audit`                         | Not run (no known vulnerability scanning configured)   |

---

## Findings Table

| # | Severity | Area          | Finding                                          | Evidence                                                        | Recommendation                                                  |
|---|----------|---------------|--------------------------------------------------|-----------------------------------------------------------------|----------------------------------------------------------------|
| 1 | Critical | Performance   | N+1 query problem in dashboard endpoint          | `src/orders.js:10-12` — loop runs 1 query per order; with 100 orders = 101 database round-trips. Function executes sequential queries in a loop: each of 100 returned orders triggers a separate customer lookup query | Use a JOIN or IN clause to fetch all customers in one batch query. Replace the loop with: `SELECT ... FROM orders o JOIN customers c ON o.customer_id = c.id ORDER BY placed_at DESC LIMIT $1`                              |
| 2 | Critical | Performance   | Missing index on placed_at column               | `migrations/0001_init.sql:16` — only index is on status; `src/orders.js:5` queries `ORDER BY placed_at DESC` without index. On a table with millions of rows, this forces a full table scan and sort operation | Add index: `CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC);` in migration                            |
| 3 | High     | Performance   | Missing index on customer_id foreign key        | `migrations/0001_init.sql:9` — customer_id column has a foreign key constraint but no index; `src/orders.js:11` and `src/orders.js:27` query by customer_id. Without an index, lookups require full table scans | Add index: `CREATE INDEX orders_customer_id_idx ON orders (customer_id);` in migration                             |
| 4 | High     | Performance   | Inefficient LIKE pattern in search function     | `src/orders.js:20` — query uses `WHERE reference LIKE '%' \|\| $1 \|\| '%'`. Leading wildcard prevents index use on reference column; will scan all rows | Use a proper search index (e.g., trigram GiST in PostgreSQL) or change search strategy. If prefix search is acceptable, use `reference LIKE $1 \|\| '%'` (no leading wildcard) and add index on reference |
| 5 | Medium   | Reliability   | Unhandled error in customer attachment          | `src/orders.js:11-12` — customer lookup query has no error handling. If the customer query fails or times out, the promise rejection will crash the request and return no response to caller | Wrap the customer query in try-catch and provide a sensible default (e.g., `order.customer = null` on error, or log and continue) |
| 6 | Medium   | Testing       | Insufficient test coverage                      | `test/orders.test.js` — only 1 test that checks schema file content; no integration tests for actual query functions or database behavior | Add tests for: listRecentOrders (with mocked/test data), searchOrders with various patterns, ordersForCustomer, and error cases |
| 7 | Low      | Architecture  | Connection pool size may be undersized           | `src/db.js:3` — pool max is hardcoded to 10. If dashboard is the busiest endpoint with 100-order queries, and each query waits for customer lookups, 10 concurrent connections may be insufficient under load | Evaluate concurrency needs. For a busy dashboard, consider increasing to 20-50 depending on expected concurrent users |

---

## Unconfirmed Issues

**Performance threshold**: The assessment confirms that the queries are inefficient (N+1, missing indexes), but the exact latency impact depends on:
- Current orders table row count (README mentions "millions")
- Database server spec and current load
- Network latency between application and database
- Concurrent request load on the service

**Root cause confirmation**: Code clearly shows no index on placed_at and sequential customer queries, which are sufficient to explain slowdown on a large table. However, actual query execution plans from the database would definitively confirm this is the bottleneck (vs. other infrastructure issues).

---

## Summary

### Strengths

1. **Secure query construction**: All queries use parameterized statements with the pg driver (e.g., `$1` placeholders), preventing SQL injection attacks.
2. **Connection pooling**: Proper use of a pg.Pool with a fixed maximum ensures resource efficiency and prevents connection leaks.
3. **Clean API design**: Three focused functions (listRecentOrders, searchOrders, ordersForCustomer) with clear responsibilities and simple interfaces.

### Key Risks

**Critical**: Findings #1 and #2 together explain the slowdown. The `listRecentOrders` function combines:
- A missing index on the sort column (`placed_at`), forcing a full table scan and sort of millions of rows for every request
- An N+1 query pattern that multiplies database load by the result set size (100 orders = 100+ extra queries per request)

On a table with millions of rows, a single call to the dashboard endpoint generates ~101 database operations. This is the primary cause of slowness reported.

**High**: Missing indexes on `customer_id` (Finding #3) compound the issue and slow the support tool endpoint (`ordersForCustomer`). The search function (Finding #4) is inefficient but less critical if not heavily used.

### Priority Order

1. **Add index on placed_at DESC** (Finding #2) — Quick fix, high impact. Resolves full table scan on every dashboard load.
2. **Replace N+1 customer lookups with a JOIN** (Finding #1) — Highest impact. Reduces 101 queries per dashboard request to 1. Requires code change in `listRecentOrders`.
3. **Add index on customer_id** (Finding #3) — Medium effort, medium impact. Fixes `ordersForCustomer` lookups.
4. **Add error handling** (Finding #5) — Quick fix, improves reliability.
5. **Improve search query** (Finding #4) — Lower priority unless search is a bottleneck; requires schema/strategy decision.
6. **Expand test coverage** (Finding #6) — Medium effort; improves maintainability and catch future regressions.

### Coverage Gaps

**Not examined**:
- The actual HTTP server that wraps these functions (entry point not included in workspace; package.json lists src/orders.js as main but no server/routing code is present)
- Production database configuration, replication, or read replicas (only code assessed, no infrastructure)
- Actual query execution plans from PostgreSQL EXPLAIN output (would confirm slowness)
- Application-level caching or Redis configuration (not in the codebase)
- Load test results or production metrics (not available in workspace)
- Comparison of query performance before/after adding indexes (would require test environment)

**Tools not run**:
- npm audit (no vulnerability scanning tools configured)
- Custom benchmarking or profiling tools (none detected in project)
- Database query analysis tools (would require live database connection)

---

## Evidence Summary

**What was verified:**
- All JavaScript files (3) read and analyzed for logic, query patterns, and performance issues
- Migration SQL file reviewed for schema and indexes
- Test file reviewed for coverage scope
- npm test executed and passed
- package.json reviewed for dependencies and scripts
- Project structure confirms Node.js + PostgreSQL stack

**Conclusion**: The dashboard slowness is directly caused by missing database indexes (particularly on `placed_at`) combined with an N+1 query anti-pattern in the `listRecentOrders` function. Both issues are confirmed in the code with specific line number evidence. The inefficient search query is a secondary concern.
