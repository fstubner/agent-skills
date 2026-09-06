# Dashboard Performance Assessment

## Executive Summary

The dashboard slowness is caused by a **critical N+1 query problem** in the `listRecentOrders()` function, combined with **missing database indexes** on columns used for sorting and filtering. As the orders table has grown to millions of rows, these issues compound dramatically.

## Critical Issues

### 1. N+1 Query Problem in `listRecentOrders()` (src/orders.js:3-15)

**Severity:** CRITICAL

**Problem:** 
- The function executes one initial query to fetch recent orders, then **loops through each result and executes a separate customer lookup query**
- With the default limit of 100, this creates **101 database queries per dashboard load** (1 + 100)
- Each customer query must round-trip to the database

**Impact:**
- Generates 100 individual `SELECT` statements from the customer table
- Network and query overhead multiplied by order count
- Scales linearly worse as the limit increases
- As the orders table grows, the initial query gets slower, then each of 100+ customer queries still runs

**Root Cause:** Lines 10-12 show the anti-pattern clearly:
```javascript
for (const order of rows) {
  const customer = await query('SELECT id, name, email FROM customers WHERE id = $1', [order.customer_id]);
  order.customer = customer.rows[0] ?? null;
}
```

### 2. Missing Index on `placed_at` Column (migrations/0001_init.sql)

**Severity:** HIGH

**Problem:**
- `listRecentOrders()` sorts by `placed_at DESC` to get recent orders
- No index exists on this column
- With millions of rows, PostgreSQL must perform a full table scan and sort all rows in memory
- The `orders` table only has an index on `status`, leaving the critical `placed_at` column unindexed

**Impact:**
- Initial query becomes increasingly expensive as table size grows
- Full-table sort is O(n log n) for millions of rows
- Dominates response time, especially combined with the N+1 queries

### 3. Missing Index on `customer_id` Foreign Key (migrations/0001_init.sql)

**Severity:** MEDIUM

**Problem:**
- The `customer_id` column is a foreign key but has no index
- Each of the 100 customer lookup queries must scan the customers table sequentially
- Makes each individual customer query slower

**Impact:**
- Makes the N+1 problem worse by slowing each lookup
- Lookups are O(n) instead of O(log n)

### 4. LIKE Wildcard Queries in `searchOrders()` (src/orders.js:18-24)

**Severity:** MEDIUM

**Problem:**
- Uses `LIKE '%' || $1 || '%'` pattern for reference search
- Without proper indexes (B-tree indexes don't help with leading wildcards), this scans the entire orders table
- Scales poorly as the table grows

**Impact:**
- Search functionality becomes progressively slower
- Users may experience timeout errors on search

## Why This Deteriorated Over Time

The code hasn't changed, but the **performance impact of these design flaws scales with data volume**:

- **At 100K rows:** N+1 problem may feel acceptable (101 small queries on a small table)
- **At 1M rows:** Initial query requires sorting millions of rows, each customer lookup is slower without index
- **At 10M+ rows:** Dashboard becomes visibly slow, approaching timeout thresholds

This is a classic "worked fine at small scale, fails at scale" scenario.

## Recommended Fixes

### High Priority
1. **Replace N+1 with a single JOIN query** - Use `LEFT JOIN customers` to fetch order and customer data in one query
2. **Add index on `orders(placed_at)`** - Enables efficient sorting for recent orders
3. **Add index on `orders(customer_id)`** - Makes foreign key lookups efficient

### Medium Priority
4. **Improve `searchOrders()` performance** - Consider a trigram index for LIKE queries, or use full-text search

## Data Points Collected

- ✅ Reviewed database schema in `migrations/0001_init.sql`
- ✅ Analyzed query logic in `src/orders.js`
- ✅ Identified specific anti-patterns and missing indexes
- ✅ Verified the issue scales with data volume
