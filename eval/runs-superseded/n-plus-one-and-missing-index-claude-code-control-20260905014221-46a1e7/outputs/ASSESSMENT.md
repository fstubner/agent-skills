# Performance Assessment: Orders Dashboard

## Critical Issue: N+1 Query Problem

The `listRecentOrders()` function in `src/orders.js` has a severe N+1 query antipattern that is the primary cause of slowdown:

**Current Implementation:**
```javascript
// Fetches orders (1 query)
const { rows } = await query(
  'SELECT id, customer_id, status, total_minor FROM orders ORDER BY placed_at DESC LIMIT $1',
  [limit],
);

// Then for EACH order, executes an additional query (100 queries for limit=100)
for (const order of rows) {
  const customer = await query('SELECT id, name, email FROM customers WHERE id = $1', [order.customer_id]);
  order.customer = customer.rows[0] ?? null;
}
```

**Impact:**
- For a dashboard displaying 100 orders: **101 database queries** (1 initial + 100 customer lookups)
- As the orders table grew from thousands to millions of rows:
  - The initial `ORDER BY placed_at DESC` query became progressively slower without an index
  - The overhead of executing 100+ sequential customer queries compounds
  - Network round trips to the database multiply for each order

**Why it worked before:** With a small table (thousands of rows), the performance penalty was acceptable. At millions of rows, the cumulative effect becomes severe.

---

## Missing Database Index

The `orders` table is missing a critical index:

**No index on `placed_at` column:**
- The dashboard query sorts by `placed_at DESC LIMIT` without an index
- Forces a full table scan on millions of rows instead of efficient indexed access
- This is the most frequent query pattern for the dashboard

---

## Secondary Issue: Inefficient Search Query

The `searchOrders()` function uses a LIKE query with leading wildcard:
```javascript
"SELECT id, reference, status FROM orders WHERE reference LIKE '%' || $1 || '%' ORDER BY placed_at DESC"
```

**Problems:**
- The leading `%` wildcard prevents index usage on the `reference` column
- Requires full table scan of millions of orders
- Not as critical as the N+1 issue, but contributes to overall slowdown

---

## Missing Foreign Key Index

No explicit index on `orders.customer_id` (the foreign key), which could benefit other queries joining these tables.

---

## Summary of Root Causes

1. **N+1 query pattern** (primary): 100+ sequential database queries per dashboard load
2. **Missing `placed_at` index**: Full table scans on the orders table for the main dashboard query
3. **Inefficient wildcard search**: Full table scans for search functionality
4. **Missing foreign key index**: Suboptimal join performance

The N+1 problem is the dominant issue and explains the performance degradation as data volume increased.
