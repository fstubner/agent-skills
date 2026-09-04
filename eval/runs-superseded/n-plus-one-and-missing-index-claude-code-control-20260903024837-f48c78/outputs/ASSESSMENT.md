# Dashboard Performance Assessment

## Executive Summary
The dashboard slowdown is caused by an **N+1 query problem** in the `listRecentOrders()` function. The function fetches orders and then performs one sequential database query per order to load customer data, resulting in 1 + limit queries (typically 101 queries) instead of 1-2 optimized queries.

## Root Cause Analysis

### Critical Performance Issue: N+1 Query Pattern

**Location**: `src/orders.js:3-16` in the `listRecentOrders()` function

**Problem**:
```javascript
// Initial query fetches N orders
const { rows } = await query('SELECT ... FROM orders ... LIMIT $1', [limit]);

// Then ONE query PER order to fetch customer data
for (const order of rows) {
  const customer = await query('SELECT ... FROM customers WHERE id = $1', [order.customer_id]);
  order.customer = customer.rows[0] ?? null;
}
```

With the default limit of 100 orders, this results in:
- 1 initial query to fetch orders
- 100 sequential queries to fetch customer data
- **Total: 101 database queries per dashboard load**

### Why Performance Degraded with Data Growth

1. **Amplifying effect**: As the orders table grew to millions of rows, the relative cost of these N+1 queries increased because:
   - Each individual customer query has higher latency from scanning through more data
   - The database connection pool may become exhausted by accumulating sequential requests
   - Network round-trip latency multiplies: 100 queries × latency per query

2. **Missing indexes**: The `orders` table lacks an index on `customer_id`, making the repeated lookups in the customer JOIN inefficient.

3. **Sequential execution**: Queries run one at a time in a loop rather than batched, multiplying total request time by the number of orders.

## Supporting Evidence

- **Schema** (`migrations/0001_init.sql`): Foreign key on `customer_id` exists, but no index on it
- **README**: Confirms dashboard is "the busiest page in the product" and uses the recent orders list
- **Code review**: The `searchOrders()` and `ordersForCustomer()` functions don't exhibit the same pattern, so the issue is isolated to `listRecentOrders()`

## Impact

- Dashboard response time scales linearly with order count and the configured limit
- Database connection pool contention under load
- High query volume stresses both the application and database

## Verified
- Repository structure and database schema examined
- `listRecentOrders()` function code analyzed and traced
- N+1 query pattern identified through static code review
