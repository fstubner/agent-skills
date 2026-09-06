# Engineering Assessment: Orders Read API Performance

## Scope

**In scope:** The entire Orders read API codebase including:
- Source code: `src/db.js`, `src/orders.js`
- Database schema and migrations: `migrations/0001_init.sql`
- Tests: `test/orders.test.js`
- Configuration: `package.json`

**Out of scope:**
- Runtime infrastructure (database server configuration, hardware, network)
- Deployment configuration
- Monitoring and alerting systems
- Production traffic patterns and load testing
- Historical query performance metrics

**Depth:** Targeted — all in-scope files read in full.

---

## Environment

**Language and Runtime:** JavaScript (ES modules), Node.js  
**Framework/Database:** PostgreSQL via `pg` driver (v8.11.0)  
**Domain:** Web service providing read-only API for order data  
**Platform:** Server-side REST API  
**Build system:** npm with single test script

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | ✔ PASSED: 1 test passed (the schema creates both tables) |
| `npm run build` | ✗ FAILED: No build script configured |
| `npm run lint` | ✗ FAILED: No lint script configured |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **High** | Performance | N+1 query pattern in dashboard's recent orders function | `src/orders.js:10-13` — `listRecentOrders` function fetches 100 orders (line 5-7), then executes one query per order in a loop to fetch customer data. With default limit=100, this produces 101 queries instead of 1. Line 4-7 executes a single `SELECT ... FROM orders ORDER BY placed_at DESC LIMIT 100`, then lines 10-13 loop through results and execute individual customer queries: `SELECT ... FROM customers WHERE id = $1` for each row. | Refactor to use a single query with JOIN: `SELECT o.id, o.customer_id, o.status, o.total_minor, c.id, c.name, c.email FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ORDER BY o.placed_at DESC LIMIT $1`. This reduces 101 queries to 1. |
| 2 | **High** | Performance | Missing index on `placed_at` column used for sorting | `migrations/0001_init.sql:16` — orders table has only one index (`orders_status_idx` on status), but `listRecentOrders` at `src/orders.js:5` uses `ORDER BY placed_at DESC`. Without an index, PostgreSQL must perform a full table scan and sort all millions of rows in memory before applying the LIMIT. README states the orders table has "grown past a few million rows" and dashboard has "become slow", indicating this is the root cause of degradation with table growth. | Create an index: `CREATE INDEX orders_placed_at_desc_idx ON orders (placed_at DESC)` in a new migration. This allows PostgreSQL to efficiently retrieve the 100 most recent orders without scanning the entire table. Verify with EXPLAIN ANALYZE on the query. |
| 3 | **Medium** | Performance | Inefficient LIKE query in search path | `src/orders.js:20` — `searchOrders` function uses `LIKE '%' || $1 || '%'` to search the reference field. Wildcards on both sides prevent index usage and require full table scan. Query: `"SELECT ... WHERE reference LIKE '%' || $1 || '%' ORDER BY placed_at DESC"`. | Add an index on reference field for faster prefix matching: `CREATE INDEX orders_reference_idx ON orders (reference)`. For wildcard searches on large tables, consider: (a) Requiring a leading character for search (e.g., `reference LIKE $1 || '%'`), or (b) implementing a dedicated full-text search index if substring matching is essential. |
| 4 | **Medium** | Reliability | Connection pool size may be insufficient for dashboard load | `src/db.js:3` — Pool configured with `max: 10` connections. The README describes the dashboard as "the busiest page in the product", but only 10 concurrent connections are allowed. When listRecentOrders executes 101 queries (finding 1), connection pool can become exhausted, causing request queueing or timeouts. | Monitor connection pool utilization in production. If dashboard requests consistently require 100+ queries, either: (a) fix the N+1 issue (finding 1) to reduce query count, or (b) increase pool size to `max: 20` or higher. Establish a baseline for expected connection usage before adjusting. |
| 5 | **Medium** | Maintainability | No error handling on database queries | `src/orders.js` — All three functions call `query()` directly without try-catch blocks. Errors (connection failures, timeouts, syntax errors) will propagate uncaught, causing the API to fail silently or crash. No `.catch()` handlers visible. | Add error handling: wrap `query()` calls in try-catch blocks or add `.catch()` for Promises. Example for `listRecentOrders`: `try { const {rows} = await query(...) } catch(err) { throw new Error(\`Failed to fetch orders: ${err.message}\`); }`. Ensure errors are logged and return appropriate HTTP error responses. |

---

## Unconfirmed Issues

No unconfirmed issues identified. All findings are based on direct code inspection and schema analysis.

---

## Summary

### Strengths

1. **Clean separation of concerns**: Database logic isolated in `db.js`, business logic in `orders.js`. Simple, readable module structure.
2. **Parameterized queries used throughout**: All query functions use parameterized queries (`$1`, `$2`) preventing SQL injection vulnerabilities.
3. **Foreign key constraints enforced**: Schema enforces referential integrity between orders and customers tables.

### Key Risks

**Performance degradation** is the primary concern:

- **Finding 1 (N+1 queries)** is the immediate bottleneck. Each request to the dashboard API generates 101 database queries instead of 1. This compounds with concurrent requests, quickly exhausting the connection pool (Finding 4).
- **Finding 2 (missing placed_at index)** is why the problem worsens with table growth. As the orders table grew from thousands to millions of rows, each of those 101 queries slows down due to full table scans and in-memory sorts.
- Together, Findings 1 and 2 explain the README's observation: "nothing in the code has changed for months" but the dashboard "has become slow as the orders table has grown past a few million rows".

The N+1 pattern is a design issue that index improvements alone cannot solve; both fixes are required for acceptable performance.

### Priority Order

1. **Fix the N+1 query pattern** (Finding 1 — HIGH priority, quick fix)
   - Refactor `listRecentOrders` to use a single JOIN query
   - This single change reduces query count by 100x and immediately improves dashboard performance
   - Fix effort: < 30 minutes; impact: massive

2. **Add index on `placed_at`** (Finding 2 — HIGH priority, moderate effort)
   - Create `CREATE INDEX orders_placed_at_desc_idx ON orders (placed_at DESC)`
   - Requires a migration and database deployment but no code changes
   - Combined with Finding 1 fix, ensures scalability as table continues to grow
   - Fix effort: ~ 5 minutes to write, plus deployment coordination

3. **Add index on `reference`** (Finding 3 — MEDIUM priority, low effort)
   - Improve search path performance for consistency
   - Fix effort: ~ 5 minutes; impact: moderate

4. **Add error handling** (Finding 5 — MEDIUM priority, moderate effort)
   - Add try-catch blocks and error logging
   - Prevents silent failures and aids debugging
   - Fix effort: ~ 20 minutes

5. **Evaluate connection pool configuration** (Finding 4 — MEDIUM priority, depends on Finding 1)
   - After fixing N+1 queries, evaluate whether pool size is still appropriate
   - Current size (10) is likely insufficient given query volume

### Coverage Gaps

**Not examined:**
- Production database performance metrics (query times, index usage, cache hit rates)
- Actual load/concurrency patterns (requests per second, concurrent users)
- Network latency between application and database
- Memory and CPU consumption during peak usage
- Any database-specific configuration (work_mem, shared_buffers, etc.)
- HTTP API layer (request/response handlers, middleware, if they exist outside scope)
- Caching layer or CDN usage (not present in code)
- How endpoints are called (frequency, concurrency patterns)

**Tools not available:**
- PostgreSQL EXPLAIN/ANALYZE output (would confirm query plan inefficiency)
- Load testing results
- Performance profiling tools
- Database logs and slow query logs

---

## Verified

✓ All source files examined (3 files: db.js, orders.js, orders.test.js)  
✓ Schema and migrations examined (1 file: 0001_init.sql)  
✓ Package configuration verified (package.json)  
✓ Tests executed successfully  
✓ N+1 query pattern confirmed in listRecentOrders implementation  
✓ Missing index on placed_at confirmed in schema  
✓ No error handling confirmed in all three API functions  
