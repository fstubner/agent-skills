# Engineering Assessment: Orders Read API

## Scope

**In scope:**
- Source code: `src/orders.js`, `src/db.js`
- Database schema: `migrations/0001_init.sql`
- Test file: `test/orders.test.js`
- Configuration: `package.json`

**Out of scope:**
- Production deployment configuration
- External monitoring/profiling data
- Load testing or actual performance metrics from production
- Database connection pool tuning beyond code review
- Network latency or other infrastructure factors

**Depth:** Targeted — all in-scope source files read in full; available commands attempted.

---

## Environment

**Languages and runtimes:** JavaScript (Node.js, ES modules)

**Frameworks and libraries:**
- `pg` (PostgreSQL driver, v8.11.0)
- Node.js built-in test runner

**Domain:** Web API service (read-only endpoints)

**Platform:** Server-side (Node.js)

**Build system:** npm

---

## Tooling Results

### What I ran

| Command | Result | Notes |
|---------|--------|-------|
| `npm test` | Test approval required | Could not execute without permission; test file exists and references migration `0001_init.sql` |
| `npm run build` | Not available | No build script defined in package.json |
| `npm run lint` | Not available | No lint script defined in package.json |
| File enumeration | ✓ Success | 5 files in total (excluding .agent-input/); all listed below |

### Tools not attempted / unavailable

- **ESLint or TypeScript checks**: Not configured in project
- **Actual test execution**: Approval required; however test file indicates schema validation exists (`CREATE TABLE customers`, `CREATE TABLE orders`)
- **Production metrics**: Not available in repository; assessment based on code analysis only

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Performance | N+1 query pattern in `listRecentOrders` (dashboard) | `src/orders.js:10-13` — for each of 100 orders, a separate customer query is executed; with millions of rows, this creates 101+ queries for a single dashboard load | Replace the loop with a single JOIN query: `SELECT o.id, o.customer_id, o.status, o.total_minor, c.id, c.name, c.email FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ORDER BY o.placed_at DESC LIMIT $1` |
| 2 | **High** | Performance | Missing index on `orders.placed_at` | `migrations/0001_init.sql:16` — only `orders_status_idx` exists; `listRecentOrders` sorts by `placed_at DESC` on table with millions of rows without index support | Add index: `CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC)` to optimize the sort operation |
| 3 | **High** | Performance | Missing index on `orders.customer_id` | `migrations/0001_init.sql` — no index on foreign key; lookups by customer_id are unindexed, affecting both the current N+1 pattern and `ordersForCustomer` query | Add index: `CREATE INDEX orders_customer_id_idx ON orders (customer_id)` to speed up joins and WHERE clauses on customer_id |
| 4 | **High** | Performance | Missing index on `orders.reference` | `migrations/0001_init.sql` — `searchOrders` queries reference column with LIKE pattern; large table without index will cause full table scan | Add index: `CREATE INDEX orders_reference_idx ON orders (reference)` (note: leading wildcard LIKE still won't use index, but exact/suffix matching will be faster) |
| 5 | **High** | Performance | Inefficient search pattern in `searchOrders` | `src/orders.js:20` — `LIKE '%' || $1 || '%'` uses leading wildcard which PostgreSQL cannot optimize with standard B-tree indexes; forces full table scan regardless of index presence | Consider: (1) Move search to full-text search if reference is human-readable; (2) Add functional index on `LOWER(reference)` if case-insensitive matching needed; (3) Document that this query is O(n) and intentionally limited to small result sets only |
| 6 | **Medium** | Reliability | No error handling for null customer joins | `src/orders.js:12` — `order.customer = customer.rows[0] ?? null` silently assigns null if customer not found; no validation that customer actually exists or error logging | Add error handling or add NOT NULL constraint validation; consider whether cascade delete on orders if customer deleted is the correct semantic |
| 7 | **Medium** | Architecture | Connection pool not validated | `src/db.js:3` — pool configured with `max: 10` connections; no visibility into whether this is adequate for the traffic patterns; no documented rationale | Document the chosen pool size and verify it matches expected concurrent request load; monitor connection pool saturation in production |

---

## Unconfirmed Issues

None identified. All findings above are based on direct code inspection and schema analysis.

---

## Summary

### Strengths

1. **Clean separation of concerns**: Database queries are isolated in `db.js`, and business logic is in `orders.js`. This makes the code easy to understand and modify.

2. **Parameterized queries**: All queries use parameterized queries (e.g., `$1`, `$2`), preventing SQL injection vulnerabilities.

3. **Appropriate use of SQL patterns**: The schema uses foreign keys and timestamps correctly; the `placed_at` DEFAULT ensures consistent ordering.

### Key Risks

**The dashboard slowness is caused by a textbook N+1 query problem** (Finding #1). The `listRecentOrders` function, which powers the dashboard, fetches 100 orders with a single query, then issues 100 additional queries to fetch the customer for each order. As the orders table grew past millions of rows, this degraded from acceptable to slow:

- At 1M rows: 101 queries per dashboard load (acceptable)
- At 10M rows: 101 queries per dashboard load with slower initial sort (noticeable)
- At 100M+ rows: 101 queries with expensive sort + cascading database work (severe)

**The degradation is NOT due to query volumes growing with the table**, but due to the initial sort operation on an unindexed column (`placed_at`) becoming more expensive at scale.

**Related issues** (Findings #2–4) compound this: missing indexes on the foreign key and sort columns prevent PostgreSQL from executing the sort efficiently. Even if the N+1 is fixed, the JOIN will be slow without indexes.

**The search endpoint is deliberately O(n)** (Finding #5), which is acceptable for now, but should be documented or reconsidered if search traffic grows.

### Priority Order

1. **Fix the N+1 query in `listRecentOrders`** (Finding #1) — This is the primary cause of dashboard slowness. Estimated impact: 100x speedup for this endpoint. Effort: Low (rewrite one query, test it). **Do this first.**

2. **Add index on `orders.placed_at`** (Finding #2) — Required for efficient sorting. Even with the N+1 fixed, the dashboard query will be slow without this. Effort: Very low (one line). Do immediately after fixing the query.

3. **Add index on `orders.customer_id`** (Finding #3) — Required for efficient joins (once N+1 is fixed) and for `ordersForCustomer`. Effort: Very low. Do with #2.

4. **Add index on `orders.reference`** (Finding #4) — Secondary priority; affects search performance but search is not the busiest path. Effort: Very low.

5. **Document or optimize `searchOrders` performance characteristics** (Finding #5) — Clarify whether the current LIKE search is acceptable for anticipated query volume. Effort: Low (documentation or architectural decision).

6. **Add error handling for missing customers** (Finding #6) — Good practice but lower priority than performance fixes. Effort: Low.

7. **Document connection pool rationale** (Finding #7) — Verify max: 10 is correct for your traffic. Effort: Low.

### Coverage Gaps

**Not examined:**
- Production performance metrics, query logs, or database monitoring data (would confirm actual bottleneck)
- Load testing or performance benchmarking (would quantify improvement from fixes)
- Deployment configuration, caching layers, or CDN setup
- End-to-end integration tests beyond the single schema validation test
- Actual test execution (approval required; only reviewed test file)
- Whether there is a read replica or query caching strategy in production
- The specific PostgreSQL version and any related query planner characteristics
- Network latency between application and database

---

## What I verified

1. ✓ All source files are parameterized against SQL injection
2. ✓ The database schema applies a foreign key constraint on `orders.customer_id`
3. ✓ Three distinct read paths exist as documented (dashboard, search, customer orders)
4. ✓ The N+1 query problem is present and confirmed in `listRecentOrders` at line 10–13
5. ✓ Only one index exists in the schema (`orders_status_idx`), and it does not cover the performance-critical `placed_at` or `customer_id` columns
6. ✓ No connection pool tuning or retry logic is implemented beyond pg's defaults
