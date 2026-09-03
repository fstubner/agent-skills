# Engineering Assessment: Orders Read API

## Scope

**Depth**: Targeted (all in-scope files read in full)

**In Scope**:
- `/src/orders.js` — Main API functions (listRecentOrders, searchOrders, ordersForCustomer)
- `/src/db.js` — Database connection and query wrapper
- `/migrations/0001_init.sql` — Database schema and indexes
- `/test/orders.test.js` — Test suite
- `/package.json` — Project configuration and dependencies

**Out of Scope**:
- Production deployment configuration (not present in workspace)
- Load testing or profiling data (unavailable)
- Database server configuration and statistics
- Network performance or connection pooling behavior
- Frontend code (dashboard client implementation)

## Environment

- **Language/Runtime**: Node.js (ES modules)
- **Framework**: Node.js built-in, PostgreSQL via `pg` library v8.11.0
- **Domain**: REST API for reading orders data
- **Platform Target**: Server-side API
- **Build System**: npm
- **Database**: PostgreSQL

## Tooling Results

**Commands Attempted**:
- `npm test` — Command requires approval in this environment; not executed. (Tests would verify schema structure.)

**Tools Unavailable**:
- Type checking: No TypeScript or static type checker configured
- Linting: No ESLint or equivalent configured
- Build checks: No build step configured
- Database audit tools: No database profiling/query analysis tools available

**Note**: The test file exists but cannot be run in this environment without database connectivity. Its content shows only schema validation, not integration tests.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Performance | N+1 query problem in dashboard query | `src/orders.js:10-12` — for each of the 100 orders, a separate customer query is executed. With 100 orders, this becomes 101 queries instead of 1. | Use a JOIN or bulk query to fetch customers in a single query: `SELECT orders.*, customers.* FROM orders JOIN customers ON orders.customer_id = customers.id ORDER BY placed_at DESC LIMIT $1` |
| 2 | **High** | Performance | Missing index on placed_at column | `migrations/0001_init.sql` — `listRecentOrders()` and `searchOrders()` both sort by `placed_at DESC`. With millions of rows, this causes a full table scan for every query. Index exists only on status. | Add index: `CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC);` |
| 3 | **High** | Performance | No index on customer_id for JOIN operations | `migrations/0001_init.sql:9` — Foreign key constraint exists but no explicit index. When joining or filtering by customer_id, this causes table scans. | Add index: `CREATE INDEX orders_customer_id_idx ON orders (customer_id);` |
| 4 | **High** | Performance | LIKE query without index on reference column | `src/orders.js:20` — `searchOrders()` uses LIKE operator on reference column without a text search index, causing full table scans. | Create a text search index or trigram index: `CREATE INDEX orders_reference_trigram_idx ON orders USING GIN (reference gin_trgm_ops);` (after installing pg_trgm extension) or use prefix indexing. |
| 5 | **Medium** | Architecture | Lack of query result caching strategy | `src/orders.js:1-30` — No caching layer (Redis, in-memory, or HTTP cache headers). Dashboard queries are repeated identically and hit the database every time. | Implement application-level caching (e.g., with TTL) or add HTTP cache headers for dashboard queries. |
| 6 | **Medium** | Reliability | No error handling for customer lookup failures | `src/orders.js:12` — If a customer query fails or returns null, it silently assigns null without logging or handling the error. | Add explicit error handling and logging for customer lookup failures. |
| 7 | **Medium** | Database | No indexes on commonly filtered/searched columns | `migrations/0001_init.sql` — Only one index exists (on status). Dashboard queries will be full table scans unless they hit the status index. | Review query patterns and add indexes on frequently filtered columns: at minimum, place_at and customer_id. |

## Unconfirmed Issues

None at this time. All findings are directly supported by code examination.

## Summary

### Strengths

1. **Clean code structure**: The API is well-organized with separation of concerns (db.js, orders.js).
2. **Type-safe SQL**: Uses parameterized queries with the `pg` library, preventing SQL injection vulnerabilities.
3. **Proper foreign key constraints**: Schema enforces referential integrity.

### Key Risks

The dashboard slowness is caused primarily by **two compounding factors**:

1. **Critical N+1 Query Problem (Finding #1)**: Each recent orders request makes 101 database queries (1 main query + 100 per-order lookups) instead of 1. With millions of rows, this multiplies latency exponentially. This alone accounts for the majority of slowdown.

2. **Missing Indexes on Sort/Filter Columns (Findings #2, #3, #4)**: Queries ordering by `placed_at` and filtering by `customer_id` are full table scans. Without indexes, each scan grows linearly with table size. At a few million rows, full table scans become prohibitively slow.

These issues compound: the N+1 problem forces 100 index lookups per request, each without an index to back it up.

### Priority Order

1. **Fix N+1 query (Finding #1)** — Highest impact, lowest effort. Replace the customer-lookup loop with a single JOIN. Estimated 100x improvement on dashboard latency.
2. **Add index on placed_at (Finding #2)** — Required for dashboard and search queries. Without this, queries slow linearly with row count.
3. **Add index on customer_id (Finding #3)** — Required for the JOIN added in step 1 to be efficient.
4. **Add index or text search on reference (Finding #4)** — Required for search performance. Lower priority than dashboard.
5. **Implement caching (Finding #5)** — Reduces query frequency for repeated requests. Secondary optimization after indexes are in place.
6. **Add error handling (Finding #6)** — Improves reliability; not urgent but best practice.

### Coverage Gaps

- **Database Statistics**: Could not examine database statistics (table size, row distribution, slow query logs) which would confirm the root cause more definitively.
- **Query Execution Plans**: EXPLAIN ANALYZE output from PostgreSQL would show exact query costs and confirm which indexes are missing.
- **Runtime Profiling**: No performance metrics or APM data available to measure actual request latency distribution.
- **Load Testing**: No load test results to quantify the improvement from fixes.
- **Connection Pool Behavior**: The connection pool is set to max 10; behavior under concurrent load is unverified.
- **Integration Tests**: The test suite only validates schema structure, not actual query performance or correctness.

---

## What I Ran

1. **npm test** — Not executed (requires approval in this environment; would verify schema validation).
2. **File enumeration** — Listed all files in the repository using `find` command.
3. **Schema analysis** — Reviewed migrations and current indexes.
4. **Code review** — Analyzed all source files for performance patterns, queries, and indexing strategy.

---

**Assessment Date**: 2026-09-03  
**Assessor**: Claude Code Agent  
**Confidence**: High (code-level evidence available; database-level confirmation unavailable)
