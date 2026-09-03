# Engineering Assessment: Orders Read API

## Scope

**In scope:**
- `src/orders.js` — API functions for listing orders
- `src/db.js` — Database connection layer
- `test/orders.test.js` — Test suite
- `migrations/0001_init.sql` — Database schema
- `package.json` — Project configuration

**Out of scope:**
- `.agent-input/` — Assessment framework files
- Production deployment configuration
- Network/infrastructure metrics
- Database replication or backup strategy
- Load testing and performance metrics

**Depth:** Targeted (all in-scope files read in full)

---

## Environment

- **Language/Runtime:** Node.js ES modules
- **Framework/Libraries:** PostgreSQL driver (`pg` ^8.11.0)
- **Domain:** Read API service for orders
- **Platform:** Server-side/backend API
- **Build/Test System:** Node.js native test runner

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | Approval required to run; not executed |
| `node --test test/orders.test.js` | Approval required to run; not executed |
| Manual code inspection | Completed successfully |
| File enumeration and schema review | Completed successfully |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Performance | N+1 query pattern in dashboard list | `src/orders.js:10-12` — `listRecentOrders()` fetches 100 orders with 1 query, then makes 100 additional customer lookups in a loop. Total: ~101 queries for one page load. | Refactor to use a single JOIN query: `SELECT o.id, o.customer_id, o.status, o.total_minor, c.id as customer_id_fk, c.name, c.email FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ORDER BY o.placed_at DESC LIMIT $1` |
| 2 | High | Performance | Missing index on `placed_at` column | `migrations/0001_init.sql:16` — Only a status index exists. The `listRecentOrders()` query orders by `placed_at DESC` on a millions-of-rows table without an index. | Add index: `CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC);` to accelerate the ORDER BY clause. |
| 3 | High | Reliability | Unhandled null customer in order object | `src/orders.js:12` — If a customer is deleted but referenced by orders, the code silently assigns `null` without logging or error handling. Dashboard rendering depends on customer data structure. | Either (a) add FK constraint enforcement, (b) log the missing customer, or (c) return a placeholder customer object instead of null. |
| 4 | Medium | Architecture | Implicit return of mutable objects | `src/orders.js:15` — The `rows` array is returned directly from the pg driver and mutated in place (line 12). Callers could modify the array and affect caching or other consumers. | Clone the array or return a new object structure to prevent unintended side effects. |
| 5 | Medium | Maintainability | Search query uses LIKE without LIMIT | `src/orders.js:20` — The `searchOrders()` function issues `WHERE reference LIKE '%' || $1 || '%'` without a LIMIT clause. On millions of rows, a broad search could scan the entire table. | Add `LIMIT $2` parameter and enforce a reasonable default (e.g., 1000 results) to prevent unbounded scans. |

---

## Unconfirmed Issues

1. **Test coverage adequacy:** Test file only verifies schema creation, not query correctness or performance. Unable to confirm if queries behave correctly without running tests against a live database.

2. **Connection pool exhaustion:** Pool is configured with `max: 10` connections. Under high dashboard load with N+1 queries, the pool could saturate, causing connection timeouts. Requires load testing to confirm.

3. **Cascading deletes or referential integrity:** Schema includes FK reference but no `ON DELETE` clause visible. Behavior on customer deletion is unconfirmed without database testing.

---

## Summary

### Strengths

- **Clean code structure:** Database queries are parameterized (using `$1`, `$2`), preventing SQL injection.
- **Separation of concerns:** Database layer is isolated in `db.js`, making it testable and reusable.
- **Clear API surface:** Three distinct functions serve different use cases (recent, search, per-customer).

### Key Risks

1. **Critical Performance Degradation (Finding #1):** The N+1 query pattern in `listRecentOrders()` is the root cause of dashboard slowness. Each page load to the busiest page in the product fires 100+ sequential database queries. This scales catastrophically with orders table growth and is the immediate blocker for dashboard performance.

2. **Missing Database Indexing (Finding #2):** Without an index on `placed_at`, the ORDER BY clause forces a full table scan on millions of rows. Combined with Finding #1, this creates a double performance hit on every dashboard load.

3. **Error Handling Gap (Finding #3):** Silently assigning `null` for missing customers masks data integrity issues and can cause downstream rendering or API contract violations.

4. **Unbounded Search Scans (Finding #5):** The reference search has no limit, risking table scans on broad queries.

### Priority Order

1. **Fix N+1 query in `listRecentOrders()` (Finding #1)** — Replace nested loop with a JOIN. Effort: low-medium. Impact: 100-1000x reduction in query count and latency on the busiest page. Do this first; it unblocks the dashboard performance issue.

2. **Add index on `orders.placed_at` (Finding #2)** — Single CREATE INDEX statement. Effort: trivial. Impact: eliminates full table scans on ORDER BY. Do this after the query is fixed or in parallel.

3. **Handle missing customers explicitly (Finding #3)** — Add logging or FK enforcement. Effort: low. Impact: prevents silent data integrity issues.

4. **Add LIMIT to search query (Finding #5)** — Add parameter and default cap. Effort: low. Impact: prevents runaway scans on reference searches.

5. **Review connection pool capacity (Finding #2 context)** — Once queries are optimized, verify pool size is adequate. Effort: medium. Impact: prevents connection exhaustion under load.

### Coverage Gaps

- **Tests not executed:** Unit tests exist but could not be run. No confirmation of query behavior or edge cases.
- **No performance benchmarks:** No baseline metrics, load testing, or query plan analysis available. Optimization recommendations are based on code inspection alone.
- **Production metrics unavailable:** No real-world dashboard latency data, query counts, or user feedback incorporated. Assessment is based on code inspection.
- **Database version and configuration unknown:** Performance characteristics depend on PostgreSQL version and configuration (work_mem, shared_buffers, etc.).
- **No analysis of:** connection reuse patterns, query caching, client-side data loading strategies, or partial page rendering.
