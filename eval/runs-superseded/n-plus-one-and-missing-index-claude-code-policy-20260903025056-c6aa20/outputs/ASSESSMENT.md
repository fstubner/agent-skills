# Dashboard Performance Assessment

## Summary
The dashboard slowdown is caused by three critical performance issues that degrade exponentially as table size grows. With millions of rows, queries that took milliseconds can now require seconds.

## Critical Issues

### 1. N+1 Query Problem in `listRecentOrders()` (src/orders.js:3-16)
**Severity: CRITICAL**

The dashboard endpoint executes one query to fetch recent orders, then **executes an additional query for each order to fetch its customer**. For a limit of 100 orders, this creates 101 database round-trips.

```javascript
// Fetches 100 orders
const { rows } = await query('SELECT ... FROM orders ORDER BY placed_at DESC LIMIT $1', [limit]);

// Then for EACH order, fetches its customer (100 additional queries)
for (const order of rows) {
  const customer = await query('SELECT ... FROM customers WHERE id = $1', [order.customer_id]);
  order.customer = customer.rows[0] ?? null;
}
```

**Impact**: With millions of rows, this scales linearly. Each 100-order page load now requires 101 sequential queries instead of 1 JOIN. Network latency and query overhead multiply. This is why the dashboard became slow as data grew—the code never changed, but query count scales with table size.

**Root cause**: No JOIN used in the main query; customer data attached in a loop instead.

---

### 2. Missing Index on `placed_at` (migrations/0001_init.sql)
**Severity: HIGH**

The orders table is queried with `ORDER BY placed_at DESC` to fetch recent orders, but there is no index on the `placed_at` column. The schema only creates an index on `status`.

```sql
CREATE INDEX orders_status_idx ON orders (status);
```

**Impact**: With millions of rows, ordering by `placed_at` forces a full table scan and sort. This is prohibitively expensive at scale.

---

### 3. Missing Index on `reference` (migrations/0001_init.sql)
**Severity: MEDIUM**

The `searchOrders()` function searches the `reference` column with a LIKE pattern:

```javascript
"SELECT id, reference, status FROM orders WHERE reference LIKE '%' || $1 || '%' ..."
```

Without an index on `reference`, this also requires a full table scan on a millions-row table.

---

## Why the slowdown became apparent as data grew

- **Small dataset (thousands of rows)**: The N+1 queries and missing indexes are tolerable because full table scans complete quickly.
- **Large dataset (millions of rows)**: 
  - Each N+1 query becomes noticeable (100 round-trips instead of 1).
  - A full table sort by `placed_at` scans millions of rows.
  - A LIKE search scans all millions of rows.

No code changed, but query time scaled with data volume.

---

## Verification Performed

- Reviewed schema definition in `migrations/0001_init.sql` for index coverage.
- Traced the `listRecentOrders()` function through customer attachment logic.
- Confirmed `searchOrders()` uses LIKE without an index on the target column.
- Confirmed `ordersForCustomer()` can use the implicit foreign-key relationship but has no index on `customer_id`.
