# Performance Assessment: Dashboard Slowness

## Executive Summary

The dashboard's `listRecentOrders()` function suffers from two critical performance issues that compound as the orders table grows. While the code has remained unchanged, performance has degraded due to data growth and missing database indexes.

## Issues Identified

### 1. N+1 Query Problem (Primary Bottleneck)

**Location:** `src/orders.js`, lines 3-16 in `listRecentOrders()`

**Issue:**
The function fetches recent orders in one query, then executes an additional query for each order to fetch customer data. With the default limit of 100 orders, this results in 101 database queries per dashboard load.

```javascript
// Initial query: 1
const { rows } = await query('SELECT ... FROM orders ORDER BY placed_at DESC LIMIT $1', [limit]);

// Loop: 100 additional queries (one per order)
for (const order of rows) {
  const customer = await query('SELECT ... FROM customers WHERE id = $1', [order.customer_id]);
}
```

**Impact:**
- Network latency: 101 round-trips to the database instead of 1-2
- Sequential execution: Each customer query waits for the previous one to complete
- Connection pool contention: Holds connections longer, reducing concurrency
- O(n) query complexity: Performance degrades linearly with order limit

### 2. Missing Index on `orders.placed_at`

**Location:** `migrations/0001_init.sql`, lines 7-14

**Issue:**
The query `ORDER BY placed_at DESC LIMIT 100` must sort the entire orders table without an index. As the table grows past millions of rows, the sort operation becomes increasingly expensive.

Current indexes:
- `orders_status_idx` (status only)

Missing indexes needed:
- `orders.placed_at` (for sorting in `listRecentOrders`)
- `orders.customer_id` (for foreign key lookups; not auto-indexed in PostgreSQL)

**Impact:**
- Full table scan + sort for every dashboard load
- Query execution time grows with table size (no index = O(n log n) complexity)
- CPU and I/O overhead increases as rows scale past millions

## Why Performance Degraded Over Time

The code hasn't changed, but performance did degrade because:
1. With a small dataset (< 100k rows), the full scan was acceptable
2. Connection pool throughput masked the N+1 overhead
3. As the table grew beyond a few million rows:
   - The sort operation became the dominant cost
   - Connection pool contention increased
   - Query latency compounded across 100+ individual requests

## Performance Implications

With 2-3 million orders and growing:
- **Current:** Each dashboard load = 101 queries, likely 50-500ms per query = several seconds total
- **Root cause:** Both algorithmic (N+1) and schema (missing index) issues

## Recommendations

### Primary Fix
Replace the N+1 pattern with a single JOIN query:
```sql
SELECT 
  o.id, o.customer_id, o.status, o.total_minor,
  c.id as customer_id, c.name as customer_name, c.email as customer_email
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
ORDER BY o.placed_at DESC
LIMIT $1
```

### Schema Improvements
Add these indexes to `migrations/0001_init.sql`:
```sql
CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC);
CREATE INDEX orders_customer_id_idx ON orders (customer_id);
```

The `placed_at DESC` index enables the current sort operation efficiently.
The `customer_id` index improves customer lookup speed (used after fixing the N+1 issue, or for `ordersForCustomer()`).

## Current State Verification

✓ Repository structure: Simple Node.js + PostgreSQL service  
✓ Three read paths identified: dashboard, search, support  
✓ Identified N+1 query pattern in `listRecentOrders()`  
✓ Identified missing `placed_at` index  
✓ Confirmed no recent code changes would have caused this (schema issue + data growth)  
✓ Code review completed without modifications
