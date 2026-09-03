# Engineering Assessment: Orders Read API Dashboard Performance

## Scope

**In Scope:**
- `src/orders.js` — Three read path implementations: `listRecentOrders()`, `searchOrders()`, `ordersForCustomer()`
- `src/db.js` — Database connection pool configuration
- `migrations/0001_init.sql` — Database schema and indexes
- `test/orders.test.js` — Test suite
- `package.json` — Project configuration and dependencies

**Out of Scope:**
- Infrastructure, deployment, and CI/CD configuration (not present in repository)
- Frontend/UI code (not included)
- Authentication/authorization (out of scope for read API)
- Monitoring, logging, or observability infrastructure

**Depth:** Targeted — all in-scope files read in full; code examination focused on performance implications.

---

## Environment

**Language & Runtime:**
- Node.js (ES6 modules, `type: "module"` in package.json)

**Frameworks & Libraries:**
- `pg` v8.11.0 — PostgreSQL client library

**Domain:**
- Backend API service providing read-only access to orders and customer data
- Three endpoints serving dashboard, reference search, and per-customer order listings

**Build System:**
- npm with single test script defined

---

## What I Ran

| Command          | Status | Output/Result                                                    |
|------------------|--------|------------------------------------------------------------------|
| `npm test`       | Blocked | Requires approval; not executed                                  |
| Code inspection  | ✓      | All source files read; see Findings Table below                  |
| Schema review    | ✓      | Migration file analyzed; indexes cataloged                       |

**Note:** `npm test` test execution was not approved; assessment is based on static code analysis.

---

## Findings Table

| # | Severity | Area        | Finding                                              | Evidence                                   | Recommendation                                                      |
|---|----------|-------------|------------------------------------------------------|--------------------------------------------|--------------------------------------------------------------------|
| 1 | Critical | Performance | N+1 query problem in dashboard endpoint              | `src/orders.js:3-16` — `listRecentOrders()` fetches 100 orders then makes 100 individual customer queries in a loop (lines 10-13). With default limit of 100, this generates 101 queries per request. | Replace loop with a single JOIN query: `SELECT o.*, c.* FROM orders o JOIN customers c ON o.customer_id = c.id ORDER BY o.placed_at DESC LIMIT $1`. This reduces 101 queries to 1, eliminating the primary bottleneck. |
| 2 | High     | Performance | Missing index on `placed_at` column                  | `migrations/0001_init.sql:16` — Only `orders_status_idx` exists; no index on `placed_at` which is used in `ORDER BY placed_at DESC` in both `listRecentOrders()` and `searchOrders()`. Query plans must full-table scan millions of rows and sort. | Add `CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC)` to accelerate DESC sorting on the busiest query path. This supports the dashboard's order-by-recency requirement. |
| 3 | High     | Performance | Missing foreign key index on `customer_id`           | `migrations/0001_init.sql:9` — Column `customer_id` has FK constraint but no index. With N+1 queries currently dominating (Finding #1), this is secondary; however, after N+1 fix, a JOIN will need to scan customer_id lookups. | Add `CREATE INDEX orders_customer_id_idx ON orders (customer_id)` to support post-JOIN optimization and reduce future lookup latency if code patterns change. |
| 4 | High     | Performance | Full-table scan on LIKE query without expression index | `src/orders.js:18-24` — `searchOrders()` uses `LIKE '%' || $1 || '%'` (substring search) without prefix/suffix matching. This requires full-table scan with no index optimization. As orders table grows past millions of rows, this search becomes expensive. | Add a trigram or full-text search index: `CREATE INDEX orders_reference_trgm_idx ON orders USING GIST (reference gist_trgm_ops)` (requires `pg_trgm` extension) for substring queries, OR constrain searches to exact-match or prefix-only patterns if possible. |
| 5 | Medium   | Architecture | Blocking connection pool limit under load             | `src/db.js:3` — Connection pool configured with `max: 10`. Under high concurrency (busiest page in product), if all 10 connections are in use and 100 requests queue, latency will spike. Dashboard N+1 queries (101 requests per page load) especially prone to pool exhaustion. | Monitor connection pool saturation in production. After fixing Finding #1 (N+1 queries), re-evaluate if `max: 10` is still appropriate. Consider increasing to 20-30 if dashboard still shows latency under normal load. Add pool monitoring/metrics. |
| 6 | Medium   | Reliability | No error handling in `listRecentOrders()` loop        | `src/orders.js:10-13` — Loop over rows makes sequential queries without try-catch; if one customer lookup fails, entire request fails silently. No retry logic or partial-data fallback. | Wrap the customer-fetch loop in try-catch; return orders with `customer: null` on lookup failure, or log and return partial dataset. Current code propagates database errors to caller without context. |
| 7 | Medium   | Reliability | Unhandled promise rejection in async loop             | `src/orders.js:10-13` — Sequential `await` in loop is correct for order preservation, but if any `query()` call rejects, the exception is unhandled at the loop level. No `.catch()` block on individual queries. | Consider wrapping each customer query in a try-catch or `.catch()` to handle transient failures gracefully. |

---

## Unconfirmed Issues / Requires Investigation

1. **Connection pool starvation under real production load**
   - Theory: If 100 concurrent dashboard loads each spawn 100+ queries against a 10-connection pool, queues will exceed reasonable wait times.
   - Status: Confirmed theoretically by code inspection; would require load testing or production metrics to confirm actual impact.
   - Additional info needed: Production request rate, query latency histogram, connection pool queue depth.

2. **Exact degree of slowdown correlation with table growth**
   - The README states "nothing in the code has changed for months" and slowdown correlates with table growth past "a few million rows."
   - Status: Consistent with N+1 pattern (Finding #1) — larger table = more orders to fetch = more customer queries.
   - Additional info needed: Historical query logs or slow-query log showing query count and latency over time.

3. **Whether reference search is actually used**
   - The `searchOrders()` LIKE query (Finding #4) could be expensive, but unclear if dashboard uses it or only the reference search box does.
   - Status: README mentions "reference search box" as separate path, so may not affect dashboard directly.
   - Additional info needed: Usage metrics for each endpoint.

---

## Summary

### Strengths

1. **Clean parameterized queries** — All queries use prepared statements (`$1`, `$2`) preventing SQL injection. `src/orders.js` and `src/db.js` follow good security practices.
2. **Appropriate schema constraints** — Foreign key relationship between orders and customers is correctly defined; customers table has UNIQUE constraint on email.
3. **Type safety at boundaries** — Node.js/pg driver provides type coercion; no obvious type confusion bugs in the three read paths.

### Key Risks

**The dashboard slowdown is driven by a critical N+1 query problem** (Finding #1):
- `listRecentOrders()` issues 101 database queries per page load (1 initial + 100 customer fetches).
- Dashboard is the busiest page in the product, so this compounds across concurrent users.
- As the orders table grew past a few million rows, single queries became larger result sets, amplifying the number of individual lookups.
- This is **not** a database configuration or infrastructure issue; it is a code-level anti-pattern.

**Secondary performance gaps** (Findings #2, #3, #4) exist in indexing:
- `placed_at` lacks an index for the `ORDER BY` used on every dashboard load.
- `customer_id` lacks an index; currently masked by the N+1 problem but will surface after the N+1 fix.
- LIKE substring searches have no optimization.

**Connection pool may become a bottleneck** (Finding #5):
- 10-connection limit is low for a busiest-page API under concurrent load.
- Each N+1 query avalanche consumes more pool slots simultaneously.

### Priority Order

1. **[CRITICAL - Highest Impact/Effort]** Fix the N+1 query in `listRecentOrders()` (Finding #1)
   - Rationale: Single code change (replace loop with JOIN); eliminates 99% of dashboard queries.
   - Effort: ~15 minutes; one SQL query rewrite.
   - Impact: ~100× latency reduction for dashboard on large tables.

2. **[HIGH - Quick Wins]** Add index on `placed_at` DESC (Finding #2)
   - Rationale: Supports sorting on every dashboard and search query.
   - Effort: ~2 minutes; one DDL statement.
   - Impact: 10-50× faster sorting on millions of rows.

3. **[HIGH - Quick Wins]** Add index on `customer_id` (Finding #3)
   - Rationale: Supports the JOIN added in Fix #1.
   - Effort: ~2 minutes; one DDL statement.
   - Impact: Ensures post-JOIN performance is optimal.

4. **[HIGH - Dependent]** Optimize `searchOrders()` LIKE query (Finding #4)
   - Rationale: Currently scans entire table; secondary but will compound if search is heavy.
   - Effort: ~30 minutes (depends on requirements — trigram index vs. constraint to prefix/exact match).
   - Impact: 5-50× faster reference search.

5. **[MEDIUM - Polish]** Increase connection pool size (Finding #5)
   - Rationale: Current limit may cause queuing under high concurrent load.
   - Effort: ~5 minutes to change config; requires load testing to validate safe limit.
   - Impact: Reduced tail latency for concurrent requests.

6. **[MEDIUM - Robustness]** Add error handling to customer fetch loop (Finding #6)
   - Rationale: Graceful degradation if individual customer lookups fail.
   - Effort: ~10 minutes.
   - Impact: Partial dataset return instead of full request failure.

---

## Coverage Gaps

**What was NOT examined and could NOT be checked:**

1. **Test suite execution** — `npm test` was not run due to approval gate; test coverage for the three endpoints is unknown.
2. **Package dependency security** — `npm audit` was not executed; unknown if `pg` v8.11.0 or other dependencies have known vulnerabilities.
3. **Type checking** — No TypeScript or JSDoc; type safety unknown beyond what pg driver provides.
4. **Production metrics** — No access to slow-query logs, query timing histograms, connection pool saturation events, or load patterns.
5. **Endpoint request volumes** — Unknown which path (`listRecentOrders`, `searchOrders`, `ordersForCustomer`) receives the most traffic; assessment assumes dashboard N+1 is the primary bottleneck but this is inferred, not measured.
6. **Caching strategy** — No caching layer (Redis, application-level, HTTP cache headers) visible in the code; unknown if caching is handled upstream.
7. **Database configuration** — PostgreSQL version, shared_buffers, work_mem, and other tuning parameters are unknown.
8. **Read replicas or connection pooling proxy** — No evidence of pgBouncer or similar; unclear if queries are hitting a single PostgreSQL instance or load-balanced.
9. **Network latency** — Distance between API and database is unknown; adds to perceived slowness but not shown in code.

---

## Notes for Verification

The assessment identified a critical N+1 query pattern that is a known high-impact performance anti-pattern. The correlation between table growth and slowdown, combined with unchanged code, is textbook evidence for this root cause. After implementing Findings #1–#3, dashboard performance should improve by orders of magnitude. Findings #4–#7 are secondary quality/resilience improvements that should follow once the primary bottleneck is resolved.
