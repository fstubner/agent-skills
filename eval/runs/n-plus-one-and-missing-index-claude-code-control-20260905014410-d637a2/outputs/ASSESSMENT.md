# Dashboard Performance Assessment

## Overview
The dashboard slowdown is caused by multiple compounding performance issues in the orders read API. The primary culprit is an N+1 query problem in the `listRecentOrders` function, exacerbated by missing database indexes on critical columns.

## Critical Issues

### 1. N+1 Query Problem (Severity: CRITICAL)
**Location:** `src/orders.js:3-16` (listRecentOrders function)

**Issue:** The function retrieves recent orders in a single query, then makes **one additional database query per order** to fetch customer data.

**Impact:**
- For the default limit of 100 orders, this generates 101 database queries per dashboard load
- With millions of rows in the orders table, query execution becomes progressively slower
- On high-traffic dashboards with concurrent users, this multiplies to thousands of queries per minute
- This is the primary driver of slowness as table size grows

**Current Flow:**
1. Single query: `SELECT id, customer_id, status, total_minor FROM orders ORDER BY placed_at DESC LIMIT 100`
2. Loop: For each of 100 rows, execute `SELECT id, name, email FROM customers WHERE id = ?`
3. Result: 101 total queries instead of 1-2

### 2. Missing Index on `placed_at` (Severity: HIGH)
**Location:** `migrations/0001_init.sql` and `src/orders.js:5`

**Issue:** The `listRecentOrders` query uses `ORDER BY placed_at DESC`, but there is no index on this column.

**Impact:**
- PostgreSQL must perform a full table scan on millions of rows to sort by placement time
- Sorting a multi-million row dataset in memory is expensive
- This degrades linearly with table size

**Current Index:** Only `orders_status_idx` exists; `placed_at` is unindexed.

### 3. Missing Index on `customer_id` (Severity: MEDIUM)
**Location:** `migrations/0001_init.sql`

**Issue:** The `customer_id` foreign key is not indexed, even though it's frequently used in lookups.

**Impact:**
- The N+1 queries in `listRecentOrders` each do a full table scan on the customers table (minor) or index scan if customers table is indexed
- If a JOIN-based solution were implemented, this index would be essential for efficiency
- Currently contributes to slow customer lookups in the repeated queries

### 4. Missing Index on `reference` (Severity: MEDIUM)
**Location:** `src/orders.js:18-24` (searchOrders function)

**Issue:** The `searchOrders` function uses `LIKE '%' || $1 || '%'` on the unindexed `reference` column.

**Impact:**
- Requires full table scan on millions of rows for each search
- Pattern matching with leading wildcard (`%term%`) is inherently difficult to optimize, but an index would still help with exact prefix matches
- Search performance degrades significantly as table grows

### 5. Connection Pool Bottleneck (Severity: MEDIUM)
**Location:** `src/db.js:3`

**Issue:** The PostgreSQL connection pool is configured with a maximum of 10 connections.

**Impact:**
- With concurrent dashboard users, requests queue waiting for available connections
- On a busy dashboard, connection pool exhaustion causes request queuing and perceived slowness
- The N+1 query problem amplifies this: 101 queries per request means rapid connection cycling and contention
- 10 connections may be insufficient for a high-traffic read API

## Root Cause Analysis

The dashboard slowness is primarily caused by **the N+1 query anti-pattern** in `listRecentOrders`. As the orders table grew from thousands to millions of rows:

1. Initially, 101 small queries might have completed in ~100ms
2. At scale, each customer lookup query now takes longer to find the matching row
3. Total time per dashboard load compounds: slow initial query (full table scan on placed_at) + 100 slow customer lookups
4. With multiple concurrent users, connection pool contention makes it worse

The missing indexes amplify the problem:
- `placed_at` index would speed the initial orders query
- `customer_id` index would speed customer lookups (if indexes existed)

## Verification Notes

- Schema created in `migrations/0001_init.sql` contains only one index (`orders_status_idx`)
- `listRecentOrders` implementation in `src/orders.js:3-16` clearly shows the N+1 pattern
- No JOIN or batch customer fetch exists in the codebase
- Test file confirms schema expectations but does not verify performance

## Recommendations (for reference)

To resolve this issue:
1. Use a single query with a JOIN to fetch orders and customer data together
2. Add index on `orders.placed_at` for efficient sorting
3. Add index on `orders.customer_id` for efficient lookups
4. Consider increasing connection pool size or implementing connection pooling strategy
5. Review `searchOrders` for similar optimization (possibly text search capabilities in PostgreSQL)
