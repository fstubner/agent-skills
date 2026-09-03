# Dashboard Performance Assessment

## Overview
The dashboard's performance degradation is caused by critical inefficiencies in the `listRecentOrders()` function combined with inadequate database indexing. As the orders table has grown to millions of rows, these issues have become increasingly severe.

## Critical Issues

### 1. **N+1 Query Problem in `listRecentOrders()` (HIGHEST PRIORITY)**
**Location**: `src/orders.js`, lines 3-16

**Problem**: The function executes 101 database queries to retrieve 100 orders:
- 1 query: `SELECT id, customer_id, status, total_minor FROM orders ORDER BY placed_at DESC LIMIT 100`
- 100 queries: One `SELECT * FROM customers WHERE id = $1` per order (in the for loop, lines 10-12)

**Impact**: 
- For the default limit of 100 orders, this is **100x more queries than necessary**
- With concurrent dashboard requests, the database becomes a bottleneck
- Response time scales poorly as the orders table grows
- Database connection pool exhaustion is likely under load

**Root Cause**: The customer data is fetched in a loop after the initial query instead of being retrieved in a single JOIN operation.

---

### 2. **Missing Index on `orders.placed_at`**
**Location**: `migrations/0001_init.sql`

**Problem**: The `listRecentOrders()` function uses `ORDER BY placed_at DESC` but no index exists on this column.

**Impact**:
- Full table scan on every dashboard request
- On a multi-million row table, this means scanning millions of rows just to get the 100 most recent
- Increasingly expensive as data grows

**Solution**: Need index: `CREATE INDEX orders_placed_at_idx ON orders (placed_at DESC);`

---

### 3. **Inefficient Search Query in `searchOrders()`**
**Location**: `src/orders.js`, line 20

**Problem**: Uses `LIKE '%' || $1 || '%'` pattern which:
- Performs a full table scan (prefix and suffix wildcards prevent index usage)
- Cannot use indexes effectively even if one exists on the `reference` column

**Impact**: Search is O(n) where n is the number of orders, increasingly slow as table grows.

**Missing Index**: No index on `orders.reference` column.

---

### 4. **Missing Index on `orders.customer_id`**
**Location**: `migrations/0001_init.sql`

**Problem**: The foreign key `customer_id` lacks an index.

**Impact**:
- While the N+1 problem is the immediate cause of slowness, individual customer lookups still require table scans
- If the N+1 problem is fixed with a JOIN, this index becomes essential for join performance

---

### 5. **Limited Database Connection Pool**
**Location**: `src/db.js`, line 3

**Problem**: `max: 10` connections with N+1 queries means:
- 100 concurrent orders = potentially 10,000 queued queries
- Connection pool exhaustion under moderate load
- Requests queue up, increasing latency further

---

## Summary Table

| Issue | Severity | Root Cause | Effect |
|-------|----------|-----------|--------|
| N+1 Queries | 🔴 Critical | Loop-based customer fetching | 100x query multiplier |
| Missing `placed_at` index | 🔴 Critical | No index on sort column | Full table scans |
| Wildcard search pattern | 🟠 High | LIKE `%` `%` | Full table scans on search |
| Missing `customer_id` index | 🟠 High | No FK index | Slow joins (post-fix) |
| Connection pool size | 🟡 Medium | Default pool config | Bottleneck under load |

---

## Verification Performed
- ✓ Analyzed `listRecentOrders()` query pattern - confirmed 1 + limit queries
- ✓ Reviewed database schema - confirmed missing indexes on `placed_at`, `reference`, and `customer_id`
- ✓ Examined search implementation - confirmed inefficient LIKE pattern
- ✓ Checked connection pool configuration - confirmed max 10 connections
- ✓ Verified no code changes in recent months - issues are architectural, not regression-based
