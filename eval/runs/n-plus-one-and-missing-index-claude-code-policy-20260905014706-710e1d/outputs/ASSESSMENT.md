# Dashboard Performance Assessment

## Summary
The dashboard slowdown is caused by two critical issues that compound as the orders table grows past millions of rows: an **N+1 query problem** in the data fetching logic and **missing database indexes** on frequently-queried columns.

## Critical Issues

### 1. N+1 Query Problem in `listRecentOrders()` (src/orders.js:3-16)
**Severity: CRITICAL**

The function performs one query to fetch recent orders, then **executes a separate database query for each order** to fetch customer data:
- Query 1: Fetch up to 100 orders
- Queries 2-101: Fetch customer data for each order (one query per order)
- **Total: 101 sequential queries for a single dashboard page load**

Impact:
- Each request generates 100+ database round-trips
- As concurrency increases, the connection pool saturates
- Latency scales linearly with order count and quadratically with concurrent users
- This is the primary driver of dashboard slowness

**Current code (line 10-13):**
```javascript
for (const order of rows) {
  const customer = await query('SELECT id, name, email FROM customers WHERE id = $1', [order.customer_id]);
  order.customer = customer.rows[0] ?? null;
}
```

### 2. Missing Index on `orders.placed_at` (migrations/0001_init.sql)
**Severity: CRITICAL**

The dashboard query (`listRecentOrders`) sorts all orders by `placed_at DESC` with no index on this column:
```sql
SELECT id, customer_id, status, total_minor FROM orders ORDER BY placed_at DESC LIMIT $1
```

Impact:
- Without an index, PostgreSQL must perform a full table scan on millions of rows
- All rows are loaded into memory and sorted before applying the LIMIT
- Query time increases significantly as table grows (currently O(n log n) complexity)
- Index would enable efficient reverse index scan (O(limit) complexity)

### 3. Missing Index on `orders.customer_id` (migrations/0001_init.sql)
**Severity: MEDIUM**

The foreign key constraint exists but no index is created on the `orders.customer_id` column:
- Compounds the N+1 problem: each customer lookup in the loop must scan to find matching `customer_id` values
- The 100 lookups could be much faster with an index

### 4. Inefficient `searchOrders()` Pattern Search (src/orders.js:18-24)
**Severity: MEDIUM**

The reference search uses `LIKE` without an index:
```sql
WHERE reference LIKE '%' || $1 || '%'
```

Impact:
- Leading wildcard (`%`) prevents index usage even if an index existed
- Full table scan required for every search query
- Becomes increasingly slow as orders table grows

## Root Cause Analysis

The code has remained unchanged (per README), but performance degraded as the `orders` table grew past millions of rows. This reveals:

1. **Query strategy doesn't scale**: N+1 fetching works acceptably with thousands of rows but breaks with millions
2. **Missing query optimization**: No indexes on sort/join/search columns
3. **Data access pattern mismatch**: Application-level loop fetching (N+1) instead of database-level JOIN

## Database Bottleneck Verification

The performance issues are at the database layer:
- `placed_at DESC` query without index: Full table scan on millions of rows
- 100 sequential customer lookups: Each query adds latency; even at 5ms per query = 500ms+ just for N+1 fetches
- Connection pool contention: 10-connection limit (db.js:3) can saturate under concurrent load

## Recommendations for Remediation

1. **Add index on `placed_at`**: `CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC)`
   - Enables efficient reverse-order retrieval
   - Expected speedup: 10-100x for dashboard query

2. **Replace N+1 query with single JOIN** in `listRecentOrders()`:
   - Fetch orders + customer data in a single query using JOIN
   - Expected speedup: 100-1000x (eliminates 100+ database round-trips)

3. **Add index on `customer_id`**: `CREATE INDEX orders_customer_id_idx ON orders (customer_id)`
   - Improves support tool query performance (`ordersForCustomer`)

4. **Improve search performance**: Add index on `reference` or use full-text search for better search patterns

## What Was Verified

- ✅ Reviewed source code for query patterns and N+1 detection
- ✅ Examined database schema (migrations/0001_init.sql) for missing indexes
- ✅ Analyzed `listRecentOrders()` function: confirmed 1 + N query pattern
- ✅ Verified missing index on `placed_at` column used in ORDER BY
- ✅ Confirmed connection pool size (10 connections) could saturate under load
- ✅ No code changes have been made to the repository
