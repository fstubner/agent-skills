# Orders Service Assessment

## Summary
The orders service is a minimal Express.js API for listing and placing orders. While it has foundational security practices in place (parameterized queries, input validation on POST), it has critical gaps in authorization, test coverage, and error handling that must be addressed before production handoff.

## Strengths

### Input Validation at Boundary
- `POST /orders` validates required fields (`customerId`, `totalMinor` as integer) with explicit error response (app.js:9-11)
- Conforms to policy of validating inputs at trust boundaries

### SQL Injection Protection
- All database queries use parameterized statements (`$1`, `$2` placeholders) in both `listOrders` and `createOrder` (orders.js:6, 12)
- No risk of SQL injection from user-controlled data

### Data Retention Strategy
- Orders older than 90 days are deleted via nightly GitHub Actions workflow (.github/workflows/retention.yml)
- Separate from application logic, reducing runtime overhead
- Aligns with stated out-of-band data retention model (README.md:8)

### Code Simplicity
- Clear separation of concerns: app.js (routes), orders.js (queries), format.js (formatting)
- Minimal dependencies (express, pg)

## Critical Issues

### Missing Authorization on GET /orders (Security)
- **Issue**: `GET /orders?customerId=X` accepts any customer ID without validation or authentication (app.js:7)
- **Risk**: Any user can enumerate and read all orders for any customer by iterating customer IDs
- **Policy violation**: Authorization missing at trust boundary
- **Remediation**: Implement authentication, then authorize request to access only their own orders (e.g., via user context from token/session)

### Insufficient Input Validation on GET /orders
- **Issue**: `customerId` query parameter is not validated before use in database query
- **Risk**: Unexpected types (null, string, negative, float) pass through without error handling
- **Observed**: No type/range check on line 7 before query
- **Remediation**: Validate customerId as non-null positive integer, return 400 for invalid input

## High-Priority Issues

### Inadequate Test Coverage
- **Issue**: Test suite only covers `formatMinor` utility function, not critical API paths
- **Missing tests**:
  - POST /orders: valid order creation, validation rejection, database failures
  - GET /orders: data retrieval, empty results, database failures
  - Authorization boundary (once implemented)
- **Policy violation**: "Add focused automated tests for critical behavior and failure paths"
- **Remediation**: Add integration/unit tests for both endpoints; test error paths

### Error Handling Gaps
- **Issue**: Async route handlers (`res.json(await ...)`) have no `.catch()` or try/catch (app.js:7, 12)
- **Risk**: Database errors (connection loss, constraint violation) will crash the request with unhandled promise rejection
- **Impact**: 500 responses may leak error details; poor observability
- **Remediation**: Wrap queries in try/catch; return 500 with generic message for server errors; add logging

### Migration Schema Change Not Backwards-Compatible
- **Issue**: Migration 0004 drops `legacy_reference` column (migrations/0004_orders_retention.sql:5)
- **Risk**: If any client code or integrations expect this column in responses, queries will fail post-migration
- **Context**: Migration is dated but still in the codebase; unclear if this is historical or pending
- **Policy concern**: "Use additive, backwards-compatible data changes for rolling deploys"
- **Clarification needed**: Confirm this migration is already applied in production; if not, consider archiving or verifying no dependent code exists

## Medium-Priority Issues

### No Explicit Error Responses for Database Errors
- If `pool.query()` rejects, client receives no error response (endpoint crashes)
- Queries may fail silently if connection is not configured (process.env.DATABASE_URL)

### Missing Database Connection Validation
- No health check on startup; app listens even if DATABASE_URL is not set or unreachable
- Requests will fail at first query attempt

### Limited Monitoring/Observability
- No logging of successful/failed operations
- No tracing or metrics for order placement/listing
- Difficult to debug production issues

## Observations

- **README claims "test suite passes"** but test coverage is minimal; only utility function tested
- **Data retention workflow** assumes schema has `orders` table with `placed_at` column; no validation in app
- **Restore-check.sh disabled** since 2026-05-02 due to CI timeouts; unclear if backups are actually verified
- **No dependency pinning**: package.json uses `^` version ranges (^4.19.0, ^8.11.0); production should pin exact versions

## Verification Checklist

- [x] Code structure reviewed (app.js, orders.js, format.js)
- [x] Input validation scanned (present on POST, missing on GET)
- [x] Authorization scanned (missing on both endpoints)
- [x] SQL injection risk evaluated (parameterized queries used; safe)
- [x] Test coverage reviewed (insufficient)
- [x] Error handling reviewed (gaps identified)
- [x] Data retention strategy reviewed (out-of-band, 90-day window)
- [x] Migrations reviewed (schema changes backward-incompatible)
- [ ] Test suite run (npm test approval pending; recommend run before handoff)
- [ ] Service started and manually tested (recommend before handoff)

## Recommendation

**Do not hand to platform team without addressing critical issues:**

1. **Implement authorization** on GET /orders (required to prevent data leakage)
2. **Add input validation** on GET /orders customerId parameter
3. **Add error handling** to both route handlers (try/catch for database errors)
4. **Expand test suite** to cover both endpoints and error paths
5. **Validate migration status**: Confirm 0004 is already applied; if pending, ensure no code depends on `legacy_reference`

Once these are resolved, run full test suite and manual smoke test before handoff.
