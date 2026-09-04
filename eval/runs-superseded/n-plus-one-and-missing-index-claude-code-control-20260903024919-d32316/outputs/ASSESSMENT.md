# Dashboard Performance Assessment

## Summary
The dashboard slowness is caused by three critical performance issues in the `listRecentOrders` function and database schema:

1. **N+1 Query Problem (Severe)**
2. **Missing Database Indexes (Severe)**

---

## Issue 1: N+1 Query Pattern in listRecentOrders

**Location:** `src/orders.js`, lines 3-16

**Problem:**
The `listRecentOrders` function fetches a list of recent orders, then executes one additional database query for each order to fetch customer details:

```javascript
// Fetches orders: 1 query
const { rows } = await query('SELECT id, customer_id, status, total_minor FROM orders ORDER BY placed_at DESC LIMIT $1', [limit]);

// Then for each order, fetches customer: N additional queries
for (const order of rows) {
  const customer = await query('SELECT id, name, email FROM customers WHERE id = $1', [order.customer_id]);
  order.customer = customer.rows[0] ?? null;
}
```

With the default limit of 100 orders, this results in **101 database queries per request** (1 for orders + 100 for customers).

**Impact:**
- At low dataset sizes, this was tolerable
- With millions of rows in the orders table, the overhead becomes severe
- Network latency is multiplied across 100+ round trips to the database
- Connection pool exhaustion (max: 10 connections) causes queueing

**Scale Problem:**
- 10 concurrent dashboard users × 101 queries each = 1,010 queries
- With high latency or slow queries, requests timeout or block other operations

---

## Issue 2: Missing Indexes on orders Table

**Location:** `migrations/0001_init.sql`, lines 16

**Problem:**
The schema has only one index on `orders(status)`. Two critical indexes are missing:

### 2a. Missing Index on placed_at
The dashboard query sorts by `placed_at DESC` to get recent orders:
```sql
SELECT id, customer_id, status, total_minor FROM orders ORDER BY placed_at DESC LIMIT $1
```

**Without an index on placed_at:**
- PostgreSQL must scan the entire orders table (millions of rows)
- Full table scan requires reading all data from disk
- Results must be fully sorted before applying LIMIT

**With an index on placed_at:**
- Database can directly access the most recent orders efficiently
- Only the required rows need to be fetched

### 2b. Missing Index on customer_id
The N+1 queries each execute:
```sql
SELECT id, name, email FROM customers WHERE id = $1
```

While the foreign key constraint exists, there is no index on `customer_id`:
- Each customer lookup requires scanning the orders table
- With 100 lookups per request, this multiplies the I/O cost
- The connection pool bottleneck compounds this

---

## Why the Slowness Appeared Recently

The README states: "nothing in the code has changed for months" yet performance degraded.

**Explanation:**
- The code has always used the N+1 pattern and lacked indexes
- With small datasets, these issues are not noticeable
- As the orders table grew from thousands to millions of rows:
  - Full table scans became very expensive (more data to read)
  - N+1 overhead multiplied (100 queries × high latency on large scans)
  - Connection pool contention increased
  - Database I/O became the bottleneck

---

## Recommended Fixes (Priority Order)

### Priority 1: Add Database Indexes (Quick Win)
Add to migration or as new migration:
```sql
CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC);
CREATE INDEX orders_customer_id_idx ON orders (customer_id);
```

### Priority 2: Fix N+1 Query Pattern (Architectural)
Replace the loop with a single SQL JOIN query or use a database query with LEFT JOIN to fetch all customer data in one request.

### Priority 3: Consider Connection Pool
Monitor if the current pool size (max: 10) is adequate for concurrent dashboard users.

---

## Verification
- Confirmed N+1 query pattern in `listRecentOrders` function
- Confirmed missing indexes on `placed_at` and `customer_id` in schema
- Identified connection pool configuration (max: 10 connections)
- Verified no index usage for recent orders query
