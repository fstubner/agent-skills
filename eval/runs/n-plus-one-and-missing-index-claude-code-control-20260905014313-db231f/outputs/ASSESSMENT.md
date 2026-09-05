# Dashboard Performance Assessment

## Summary
The dashboard slowdown is caused by a critical N+1 query problem in the `listRecentOrders` function combined with missing database indexes. As the orders table grew to millions of rows, this issue became increasingly severe.

## Critical Issues

### 1. N+1 Query Problem in `listRecentOrders()` (HIGH SEVERITY)
**Location:** `src/orders.js:3-16`

The function fetches recent orders with a single query, then executes an additional database query for **each order** to fetch customer data:

```javascript
for (const order of rows) {
  const customer = await query('SELECT id, name, email FROM customers WHERE id = $1', [order.customer_id]);
  order.customer = customer.rows[0] ?? null;
}
```

**Impact:**
- With the default limit of 100 orders, this generates **101 database queries** (1 initial + 100 per-order lookups)
- Query overhead multiplies with table size: at millions of rows, connection setup, network round-trips, and database processing compound
- Each sequential query blocks the next, creating linear latency accumulation
- This is the "busiest page in the product" according to the README, making this the highest impact bottleneck

**Solution:** Use a JOIN or subquery to fetch orders with customers in a single query instead of N sequential queries.

### 2. Missing Index on `placed_at` (MEDIUM SEVERITY)
**Location:** `src/orders.js:5` and `migrations/0001_init.sql`

The dashboard query sorts by `placed_at DESC` without an index on this column:

```sql
SELECT id, customer_id, status, total_minor FROM orders ORDER BY placed_at DESC LIMIT $1
```

**Impact:**
- Millions of rows require a full table scan or expensive sort operation
- Database must evaluate the entire table before applying the limit
- As the orders table grows, this query becomes progressively slower

**Current indexes:** Only `orders_status_idx` exists on the status column.

### 3. Missing Index on `customer_id` (MEDIUM SEVERITY)
**Location:** `migrations/0001_init.sql:9`

The `customer_id` column is a foreign key but has no index. The N+1 loop repeatedly queries by this column:

```sql
WHERE customer_id = $1
```

**Impact:**
- Each of the 100 lookups in `listRecentOrders` performs an unindexed search on millions of rows
- Without an index, PostgreSQL must scan the entire customers table or use a sequential scan

### 4. Inefficient Search Pattern (LOW-MEDIUM SEVERITY)
**Location:** `src/orders.js:20`

The reference search uses a leading wildcard pattern without a proper index:

```sql
WHERE reference LIKE '%' || $1 || '%'
```

**Impact:**
- Leading wildcards prevent index usage in standard B-tree indexes
- Full table scans are required for every search query
- Performance degrades linearly with table size

## Root Cause Analysis

The code has not changed for months (per README), but performance degraded as the orders table grew to millions of rows. This reveals:

1. **N+1 queries scale poorly:** The 100x query multiplier was hidden when the table was small, as total latency remained acceptable
2. **Missing indexes expose scaling issues:** Without proper indexes, sorting and filtering operations degrade from O(log n) to O(n) as data size increases
3. **Unindexed foreign keys:** Lookups on unindexed columns that previously completed quickly in cache became slow at scale

## Recommendations (Priority Order)

1. **Refactor `listRecentOrders` to use a single JOIN** - Eliminate N+1 queries immediately
2. **Add index on `orders(placed_at DESC)`** - Enable efficient recent orders retrieval
3. **Add index on `customer_id` foreign key** - Speed up customer lookups
4. **Consider full-text search or trigram index for reference searches** - Improve search performance
5. **Connection pool review** - Verify the pool size (currently max: 10) is sufficient for concurrent dashboard loads

## Verification

- Reviewed schema: `migrations/0001_init.sql` confirms only one index exists (on status)
- Analyzed query patterns: `src/orders.js` shows sequential customer lookups in a loop
- Examined function usage: `listRecentOrders` is the dashboard endpoint per README
- Confirmed no recent code changes per README statement
