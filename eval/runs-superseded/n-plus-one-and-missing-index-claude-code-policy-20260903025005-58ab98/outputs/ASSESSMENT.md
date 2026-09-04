# Dashboard Performance Assessment

## Summary
The dashboard's performance degradation is caused by an **N+1 query pattern** in the `listRecentOrders` function, compounded by a missing database index on the query's sort column.

## Critical Issues

### 1. N+1 Query Problem (High Impact)
**Location**: `src/orders.js` lines 3-16 (`listRecentOrders` function)

**Problem**: The function retrieves the N most recent orders, then executes one separate query **per order** to fetch customer data:
- Query 1: `SELECT id, customer_id, status, total_minor FROM orders ORDER BY placed_at DESC LIMIT $1`
- Queries 2 to N+1: `SELECT id, name, email FROM customers WHERE id = $1` (one for each order)

With the default limit of 100 orders, this produces **101 total database queries** per dashboard load.

**Impact**: As the orders table grew from thousands to millions of rows, each dashboard refresh now requires 101 round-trips to the database. This is the primary cause of the slowdown.

**Root Cause**: The function was designed when data volumes were small enough that this inefficiency was unnoticed. As data grew, the inefficiency became visible.

### 2. Missing Index on Ordering Column (Medium Impact)
**Location**: `migrations/0001_init.sql` line 16 and `src/orders.js` line 5

**Problem**: The `listRecentOrders` query sorts by `placed_at DESC` but no index exists on that column:
```sql
SELECT ... FROM orders ORDER BY placed_at DESC ...
```

The only index on the orders table is `orders_status_idx (status)`. Without an index on `placed_at`, the database must scan the entire orders table and sort it, which becomes increasingly expensive as the table grows.

**Impact**: On a table with millions of rows, this full table scan and sort operation is expensive and gets worse as data accumulates.

## Secondary Issues

### 3. Inefficient Search Query
**Location**: `src/orders.js` lines 18-24 (`searchOrders` function)

**Problem**: The search uses `LIKE '%' || $1 || '%'` which requires a full table scan. No index on the `reference` column exists.

**Impact**: Search performance degrades significantly on large tables. This affects the reference search box mentioned in the README.

## Recommendations

### Priority 1: Eliminate N+1 Query Pattern
Replace the per-order customer queries with a JOIN:
```sql
SELECT orders.id, orders.customer_id, orders.status, orders.total_minor,
       customers.id as customer_id, customers.name, customers.email
FROM orders
LEFT JOIN customers ON orders.customer_id = customers.id
ORDER BY orders.placed_at DESC
LIMIT $1
```

This reduces 101 queries to 1 query.

### Priority 2: Add Index on placed_at
```sql
CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC);
```

This enables efficient sorting for the dashboard query.

### Priority 3: Optimize Search
Add an index on the `reference` column or consider full-text search for better search performance on large datasets.

## Verification

The repository contains:
- A PostgreSQL-based orders API with customers and orders tables
- Three read paths: dashboard (recent orders), reference search, and per-customer order list
- The dashboard function (`listRecentOrders`) executes N+1 queries due to a per-order customer lookup loop
- Missing index on `placed_at` which is used to sort the most recent orders
- No code changes in recent months, confirming the issue is due to data growth exposing existing inefficiencies
