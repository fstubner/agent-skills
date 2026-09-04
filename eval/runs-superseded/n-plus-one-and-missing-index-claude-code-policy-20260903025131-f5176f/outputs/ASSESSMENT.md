# Dashboard Performance Assessment

## Summary
The dashboard's performance degradation as the orders table exceeded a few million rows is caused by **critical database query inefficiencies** that become increasingly severe with data growth. The primary issue is an N+1 query pattern combined with missing indexes.

## Critical Issues

### 1. N+1 Query Problem in `listRecentOrders()` [HIGHEST PRIORITY]
**Location:** `src/orders.js:3-15`

**Problem:**
- Fetches 100 recent orders with one query
- Then iterates through each order and makes a separate query to fetch customer data
- Total queries per dashboard load: **101 queries** (1 main + 100 individual customer lookups)
- This pattern causes exponential performance degradation as the orders table grows

**Impact:**
- Each dashboard user triggers 100 database queries instead of 1
- With millions of rows and multiple concurrent users, this creates severe database bottleneck
- Network round-trips multiply: 100 individual queries instead of 1 optimized query
- Connection pool (max 10) quickly exhausts under load, causing query queuing

**Code snippet:**
```javascript
// Separate query per order - extremely inefficient
for (const order of rows) {
  const customer = await query('SELECT id, name, email FROM customers WHERE id = $1', [order.customer_id]);
  order.customer = customer.rows[0] ?? null;
}
```

**Why this degrades with data growth:**
- Small tables: queries are fast, so 101 slow queries might still feel acceptable
- Large tables: each customer query becomes slower (more I/O), and queuing occurs when pool exhausts

### 2. Missing Index on `placed_at` Column
**Location:** `migrations/0001_init.sql:16`, `src/orders.js:5`

**Problem:**
- `listRecentOrders()` orders by `placed_at DESC` but no index exists on this column
- Only index present is on `status` (line 16 of migration)
- Query must perform a **full table scan** of millions of rows, then sort

**Impact:**
- With millions of orders, full table scan is extremely expensive
- Sorting millions of rows in-memory/on-disk is slow
- This compounds the N+1 problem: already 100 customer queries, now each happens after a slow main query

### 3. Inefficient LIKE Query in `searchOrders()`
**Location:** `src/orders.js:19-22`

**Problem:**
- Uses `LIKE '%' || $1 || '%'` with wildcards on both sides
- Leading wildcard prevents index usage in PostgreSQL
- Results in full table scan on every search operation

**Impact:**
- Search functionality degrades with data growth
- Not directly related to dashboard slowness but affects overall API performance

### 4. Connection Pool Saturation
**Location:** `src/db.js:3`

**Problem:**
- Pool limited to 10 concurrent connections
- N+1 pattern causes queries to queue when pool exhausts
- Under load, subsequent queries wait for connection availability

**Impact:**
- Amplifies the N+1 problem effect under concurrent load
- Dashboard users experience increased latency as queries queue

## Root Cause Analysis

The code has **not changed in months**, but performance degraded as data grew. This is a classic indicator of:

1. **Query patterns that don't scale linearly** - N+1 queries scale with data size
2. **Missing indexes** - Full table scans on unindexed `placed_at` column become increasingly expensive
3. **Database connection contention** - Fixed pool size with exponential query count

The performance didn't obviously break until millions of rows made the inefficiencies undeniable. Small tables masked the architectural problem.

## Additional Observations

- `ordersForCustomer()` is reasonably efficient (single query with indexed foreign key)
- Database constraints and references are properly defined
- Connection pool configuration is standard but insufficient for the query pattern used

## Recommendations for Fix

1. **Replace N+1 with JOIN** (Critical): Use `SELECT orders.* JOIN customers` to fetch related customer data in a single query
2. **Add index on `placed_at`** (Critical): `CREATE INDEX orders_placed_at_desc_idx ON orders (placed_at DESC)`
3. **Optimize search** (Important): Consider indexed `reference` column or full-text search for `searchOrders()`
4. **Monitor connection pool** (Important): Track pool exhaustion; may need to increase max connections or reduce query count

## Verified

- Repository contains 5 files defining an orders API with three read paths
- Dashboard endpoint (`listRecentOrders`) performs N+1 queries (1 + limit iterations)
- Migration file shows only one index (`status`), missing `placed_at` index
- Code has not changed but data volume has grown to millions of rows
- Performance issue is deterministic and directly attributable to query patterns, not infrastructure
