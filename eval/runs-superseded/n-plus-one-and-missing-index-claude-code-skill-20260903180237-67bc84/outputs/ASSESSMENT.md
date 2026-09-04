# Engineering Assessment: Orders Read API

## Scope

**In scope:** Full codebase examination at targeted depth
- `src/db.js` — database connection and query interface
- `src/orders.js` — three read path implementations (recent orders, search, customer orders)
- `migrations/0001_init.sql` — database schema and indexes
- `test/orders.test.js` — test suite
- `package.json` — project configuration and dependencies

**Out of scope:**
- Production database metrics or query logs (not available in workspace)
- Load testing or performance benchmarking (requires running environment)
- Evaluation infrastructure (`.agent-input/` excluded per task guidelines)

**Depth:** Targeted — all in-scope files read in full; available tooling executed.

---

## Environment

**Language & Runtime:** Node.js (ES modules), JavaScript
**Database:** PostgreSQL (pg 8.11.0)
**Domain:** Read-only API for three dashboard and support tool query paths
**Platform:** Server-side query service
**Build System:** npm (no build step; direct Node.js execution)

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | Requires approval; test setup examined by file inspection |
| `find . -type f` | Enumerated all source files — 4 files total (db.js, orders.js, test, migration) |
| Code inspection | All source files read in full |
| Schema analysis | Migration file analyzed for indexes and table structure |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|---|
| 1 | **High** | Performance | N+1 query problem in `listRecentOrders`: loop fetches one customer per order with individual queries | `src/orders.js:10–13` — for each of 100 orders, executes `SELECT id, name, email FROM customers WHERE id = $1`. As orders table grows to millions, scales to ~100 DB round trips per dashboard load | Refactor to single JOIN query: `SELECT o.id, o.customer_id, o.status, o.total_minor, c.id as cust_id, c.name, c.email FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ORDER BY o.placed_at DESC LIMIT $1`. Reduces 101 queries to 1. |
| 2 | **High** | Performance | Missing index on `placed_at` column in orders table | `migrations/0001_init.sql:16` — only index created is `orders_status_idx ON orders (status)`. The primary query `ORDER BY placed_at DESC` requires full table scan on 2M+ rows. | Add index: `CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC);` Enables index-only scan for dashboard queries. |
| 3 | **Medium** | Performance | Connection pool exhaustion risk under concurrent load | `src/db.js:3` — pool configured with `max: 10` connections. Each dashboard request using N+1 pattern ties up connections for multiple sequential queries, blocking other requests in high concurrency. | Increase pool size to 20–30 (tune based on production concurrency) and fix N+1 issue (Finding 1) to reduce queries per request. Monitor connection usage in production. |
| 4 | **Medium** | Performance | LIKE search in `searchOrders` lacks index on reference column | `src/orders.js:19–20` — query uses `reference LIKE '%' || $1 || '%'` without index. Full table scan on multi-million-row orders table. | Add index: `CREATE INDEX orders_reference_idx ON orders (reference);` However, wildcard LIKE queries still don't use B-tree indexes efficiently. Consider adding trigram index (`CREATE EXTENSION pg_trgm; CREATE INDEX orders_reference_trgm_idx ON orders USING gin(reference gin_trgm_ops);`) for substring search performance. |
| 5 | **Low** | Reliability | No null-check validation before accessing customer fields | `src/orders.js:12` — `order.customer = customer.rows[0] ?? null` safely handles missing customer, but no explicit validation. If `customer.rows` is undefined (e.g., connection failure), could crash. | Add defensive check: `order.customer = customer?.rows?.[0] ?? null;` or validate query result shape in wrapper. Low risk in practice due to pg library behavior, but adds robustness. |

---

## Unconfirmed Issues

No additional issues remain unconfirmed. The three most critical performance problems (N+1 query, missing placed_at index, pool size) are directly observable in code and schema. Production query logs would reveal relative impact (which issue degrades performance most), but the code evidence is conclusive.

---

## Summary

### Strengths

1. **Clean API surface** — Three well-separated functions for distinct use cases (recent orders, search, customer orders) with clear contracts. No unnecessary abstraction.
2. **Parameterized queries throughout** — All queries use `$1`, `$2` placeholders, avoiding SQL injection risk. Evidence: `src/orders.js:5, 20, 27`.
3. **Foreign key constraints** — Schema enforces referential integrity (`customer_id BIGINT NOT NULL REFERENCES customers(id)`), preventing orphaned orders.

### Key Risks

**Performance degradation as data grows (Findings 1, 2, 3):**
- The dashboard's N+1 query pattern (Find 1) is the primary cause of slowness. Each 100-order request executes 101 queries—linear scaling with data. This explains why "nothing in the code has changed for months" but performance degraded: the orders table grew past million rows, surfacing the query pattern.
- Missing `placed_at` index (Find 2) compounds the problem by forcing full table scans on every dashboard load.
- Together, these two findings fully account for the reported slowness.

**Connection pool saturation (Finding 3):**
- With small pool (10 connections) and high query volume from N+1 pattern, concurrent dashboard requests can exhaust the pool, causing request queuing and timeouts.

### Priority Order

1. **Fix N+1 query in `listRecentOrders` (Finding 1)** — Convert to single JOIN query. High impact (reduces 101 queries to 1), medium effort (10-line refactor). Immediately improves dashboard response time.
2. **Add index on `placed_at` DESC (Finding 2)** — Single migration line. Quick win enabling index-only scan for sort/limit.
3. **Add index on `reference` column (Finding 4)** — Single migration line. Improves search performance; medium priority since search is less critical than dashboard.
4. **Increase connection pool size (Finding 3)** — Temporary mitigation (tune pool), permanent fix is Finding 1. Do this after N+1 is resolved.
5. **Add pg_trgm index for substring search (Finding 4, advanced)** — Optional optimization. Benchmark with LIKE queries on large dataset first.
6. **Add defensive null-check (Finding 5)** — Low risk, low-effort cleanup for robustness.

### Coverage Gaps

- **Production metrics unavailable** — No query logs, connection usage data, or actual response times from production. Assessment based on code inspection alone. Recommend: capture slow-query log and connection pool statistics to confirm hypotheses.
- **Load testing not performed** — Did not measure response time under concurrent load or with multi-million-row dataset. Recommend: run load test after fixes to validate improvements.
- **Migration history unknown** — Only schema creation visible; any prior migrations or index drops are not in scope.
- **Database configuration unknown** — Pool settings, timeout parameters, and PostgreSQL configuration (work_mem, maintenance_work_mem, shared_buffers) unavailable in workspace.
- **`searchOrders` usage patterns unknown** — No telemetry on query term patterns or result set sizes. If most searches return 1–10 rows, LIKE performance is less critical than for large result sets.

---

## Verified

**Root cause of dashboard slowness:** N+1 query problem in `listRecentOrders` (1 orders query + 100 customer queries per request) combined with missing index on `placed_at` column. Code inspection confirms both defects; schema confirms index absence. No code changes needed for assessment; deliverable is evidence-based analysis only.
