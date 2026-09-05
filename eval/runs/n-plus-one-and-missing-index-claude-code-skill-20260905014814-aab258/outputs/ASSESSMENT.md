# Engineering Assessment: Orders Read API

## Scope

**In scope**: 
- `src/orders.js` — API layer with three read paths
- `src/db.js` — Database connection management
- `migrations/0001_init.sql` — Database schema and indexes
- `package.json` — Project configuration and dependencies
- `test/orders.test.js` — Test suite

**Out of scope**:
- Production deployment configuration
- Load testing or performance benchmarks beyond code review
- Database server configuration (PostgreSQL version, connection pool tuning)
- API endpoint routing and HTTP middleware
- Client-side application code consuming this API

**Depth**: `targeted` — All in-scope files read in full; code-level analysis of performance patterns; automated checks run where applicable.

---

## Environment

**Technology Stack**:
- **Language**: JavaScript (ES modules)
- **Runtime**: Node.js
- **Framework/Libraries**: PostgreSQL driver (`pg` v8.11.0)
- **Database**: PostgreSQL
- **Build System**: npm

**No automated checks available**: No linter, type checker, or test framework beyond basic schema validation is configured.

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | ✓ Passed: 1 test, 0 failures. Schema validation test confirms both `customers` and `orders` tables are created. |
| Linting | ✗ Not configured — no eslint/prettier config found. |
| Type checking | ✗ Not available — no TypeScript or JSDoc type annotations. |
| Build | ✗ Not applicable — ES module project requires no build step. |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **High** | Performance | N+1 query pattern in `listRecentOrders` causes database overload | `src/orders.js:3-16` — The function fetches the recent orders list with one query, then executes a separate SELECT query for each order's customer inside a loop (lines 10-13). With the default limit of 100 orders, this results in 101 database queries per request. As the orders table grows to millions of rows, this pattern becomes the primary bottleneck. The sequential `await` in the loop means queries execute one at a time, not in parallel. | Replace the N+1 pattern with a single JOIN query: `SELECT o.id, o.customer_id, o.status, o.total_minor, c.id, c.name, c.email FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ORDER BY o.placed_at DESC LIMIT $1`. Alternatively, fetch all customer IDs and load customers in a single batch query using `WHERE id = ANY($1)`. |
| 2 | **High** | Performance | Sequential async operations in customer-lookup loop block connection pool | `src/orders.js:10-13` — The `for (const order of rows)` loop uses `await` on each query sequentially. With a connection pool of 10 (from `src/db.js:3`), fetching 100 orders with sequential queries starves other requests and causes extreme latency variance. Each query must wait for the previous one to complete and release its connection. | Refactor to either: (a) use a JOIN query to fetch customers in one round-trip, or (b) if customers must be fetched separately, load all customer IDs in parallel with `Promise.all()` instead of sequential `await`. |
| 3 | **Medium** | Performance | Missing index on `orders.placed_at` causes full table scan on every dashboard request | `migrations/0001_init.sql:5` and `src/orders.js:5` — The query `ORDER BY placed_at DESC LIMIT $1` scans the entire orders table to sort results. With 2+ million rows, this is a full table scan on every request. While an index exists on `status` (line 16), there is no index on `placed_at`, which is used by the busiest endpoint. | Add index: `CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC);` in the migration. This will allow the database to fetch the most recent orders efficiently without scanning the entire table. |
| 4 | **Low** | Reliability | Missing error handling for null customer reference | `src/orders.js:12` — When a customer is not found, the code assigns `null` to `order.customer`. While safe, there is no validation that the order's `customer_id` foreign key constraint was actually respected. If a customer is deleted (despite the foreign key), the order will silently carry a null customer. No warning or logging occurs. | Add a defensive check or log when a customer is not found. Alternatively, document this behavior in a comment explaining that the API surface allows null customers due to denormalized response structure. This is low priority since the database constraint prevents orphaned orders in normal operation. |
| 5 | **Info** | Architecture | Three distinct read paths with different optimization needs are implemented correctly at the business logic level | `src/orders.js:18-29` — `searchOrders()` and `ordersForCustomer()` are implemented directly as single queries without the N+1 anti-pattern, showing that the developer understood the query pattern. Only `listRecentOrders()` has the defect, suggesting it may have been overlooked during initial implementation rather than a systematic misunderstanding. | This is a strength to preserve: the other read paths are implemented correctly. When fixing the N+1 pattern, ensure the same discipline is applied to all new endpoints. |

---

## Unconfirmed Issues

**Potential connection pool starvation under high concurrency** — The connection pool is configured with `max: 10` (src/db.js:3). Under high load, if many concurrent dashboard requests each open 100+ sequential queries, the pool could be exhausted, causing timeouts for other requests. This would require load testing to confirm under realistic traffic patterns.

**LIKE pattern performance** — `searchOrders()` uses `LIKE '%' || $1 || '%'` (src/orders.js:20), which is not optimizable by standard indexes. This could be slow on large datasets if the search term is common, but without metrics on the reference column cardinality or typical query volume, the actual impact cannot be confirmed.

---

## Summary

### Strengths

1. **Parameterized queries throughout** — All database calls use parameterized queries (`$1`, `$2`), preventing SQL injection. This is applied consistently across all three read paths.

2. **Correct pattern in two-thirds of the API** — The `searchOrders()` and `ordersForCustomer()` functions execute single, direct queries without N+1 anti-patterns, showing good understanding of query design in other contexts.

3. **Simple, readable code** — The source files are concise and easy to understand. No unnecessary abstractions or complex control flow obscure the logic.

### Key Risks

**Finding #1 (N+1 queries)** and **Finding #2 (Sequential async operations)** are the root cause of the reported dashboard slowness. Together, they create an exponential scaling problem:

- **Scale problem**: As orders table grows from 1M to 10M rows, the fixed cost (one query to fetch 100 recent orders) remains stable, but the variable cost (100 sequential customer queries) stays constant. However, the database becomes increasingly saturated because more clients are making the same 101 requests concurrently.
- **Connection starvation**: With only 10 connections and 101 sequential queries per request, concurrent dashboard users (e.g., 5 users) can consume all 10 connections, causing timeouts.
- **No code change required explanation**: The README notes "nothing in the code has changed for months" — the slowness emerged as *scale* changed, not code. The N+1 pattern was always present but only became problematic at higher row counts and concurrent user load.

**Finding #3 (Missing index)** compounds the issue: even the one initial query to fetch 100 recent orders becomes slower as the table grows.

### Priority Order

1. **#1 & #2 (Critical path)**: Fix the N+1 query pattern by using a JOIN or batch-loading customers. This removes the 100x query multiplier on the critical dashboard path. Estimated impact: 50–100x latency reduction.

2. **#3 (Index)**: Add `placed_at DESC` index. This optimizes the single-query optimization and helps other time-based queries if added later. Estimated impact: 5–10x latency reduction for the initial query.

3. **#4 (Defensive coding)**: Add error handling for null customers. This is low priority but improves observability.

---

## Coverage Gaps

**Not examined**:
- Production traffic patterns and actual response times — assessment is based on code review, not observability data.
- Database configuration (connection settings, query planner behavior, indexes on customers.id, which should be assumed to exist).
- Performance under realistic concurrent load — static analysis cannot measure actual latency with multiple simultaneous requests.
- Caching strategy — no HTTP caching headers, client-side caching, or database query caching is present in the code. This may or may not be a gap depending on the API contract.
- How the API is consumed (endpoint routing, serialization overhead, network latency).
- Historical performance metrics or git history explaining when the N+1 pattern was introduced.

**Tools not run** (and why):
- Profiler — requires running the code against a populated database; not available in this static analysis environment.
- Load testing — requires a running service and test database; not applicable to code review.
- Query execution plan analysis (EXPLAIN) — requires a PostgreSQL instance; cannot be run here.

---

## Verification Summary

I verified the assessment by:
1. Reading all source files (`src/orders.js`, `src/db.js`, and `migrations/0001_init.sql`) in full.
2. Tracing the execution of `listRecentOrders()` and confirming 101 sequential database queries occur by inspection of the code logic.
3. Confirming the connection pool size (10) in `src/db.js:3`.
4. Running the test suite successfully (`npm test`).
5. Identifying the missing `placed_at` index by comparing the schema against the query pattern.
6. Confirming no linting or type-checking infrastructure is configured.
7. Cross-checking findings against the severity rubric to ensure ratings match evidence and impact.
