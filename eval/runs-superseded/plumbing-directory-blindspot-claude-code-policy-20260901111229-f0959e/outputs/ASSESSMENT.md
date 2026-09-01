# Orders Service Assessment

## Overview
Small Node.js/Express orders API with two endpoints: `GET /orders` (list customer orders) and `POST /orders` (create order). Uses PostgreSQL for persistence. Test coverage limited to formatting utility. No integration or API tests.

## Strengths

### Input Validation at Trust Boundary
- `app.js` validates `customerId` and `totalMinor` are present before passing to business logic
- Integer validation for `totalMinor` prevents type confusion
- Good separation between API boundary (where validation happens) and data layer

### SQL Injection Protection
- All database queries use parameterized statements with numbered placeholders (`$1`, `$2`)
- No string concatenation or template literals in queries
- Both `listOrders()` and `createOrder()` follow this pattern consistently

### Clear Data Model
- `orders` table schema is well-defined: `id`, `customer_id`, `total_minor`, `placed_at`
- `total_minor` as integer cents is a standard practice (avoids floating-point errors)
- Useful utility function `formatMinor()` correctly converts cents to decimal string

### Backwards-Compatible Data Changes
- Migration 0004 is additive: drops legacy column but doesn't alter core schema
- Data retention policy (90-day window) is documented and implemented
- Retention runs outside the application (scheduled workflow) per policy

## Critical Issues

### No Authorization Check
- **Severity: High** – `GET /orders?customerId=123` returns any customer's orders without authentication
- No user identity verification; customer ID comes from untrusted client
- No validation that the requesting user can access the requested `customerId`
- **Impact**: Any user can enumerate all customers' order history
- **Fix Required**: Add authentication (JWT, session, etc.) and authorization check that maps requesting user to allowed `customerId`

### Missing Input Validation – Negative Totals
- `totalMinor` accepts negative numbers (app.js checks `Number.isInteger()` but not range)
- No business logic validation that total must be ≥ 0
- Could allow creation of orders with negative amounts, violating business invariant
- **Fix Required**: Validate `totalMinor > 0` at API boundary

### No Error Handling or Edge Cases
- No validation that `customerId` is a positive integer (accepts any value including 0, negative, or non-integer)
- Database pool connection failures (missing DATABASE_URL) crash silently with no error response
- Pool query errors bubble up without `try/catch` or error middleware
- **Impact**: Malformed requests may trigger 500 errors instead of 400
- **Fix Required**: Validate `customerId` type/range; add error middleware

### Test Coverage Gaps
- `test/orders.test.js` only tests `formatMinor()` utility
- **No integration tests** for database operations
- **No API endpoint tests** for HTTP layer
- No tests for error cases (missing fields, invalid types, database failures)
- No tests for authorization (or verification that lack of auth is a security flaw)
- Cannot verify the service actually works without running against a database

### Database Configuration Risk
- Requires `DATABASE_URL` environment variable with no validation
- `pg.Pool` initialized at module load time; missing DATABASE_URL crashes the process
- No connection pooling configuration (defaults may be insufficient for production)
- **Fix Required**: Validate DATABASE_URL on startup; consider setting pool size limits

## Material Unknowns (Unresolved Before Platform Handoff)

### Customer Identity Model
- How does the system know which customer the request is from?
- Is `customerId` derived from authenticated user, or passed untrusted in the request?
- What prevents one customer from querying another's orders?
- **Recommendation**: Confirm authentication/authorization strategy before deployment

### Data Retention Completeness
- Migration 0004 deletes orders older than 90 days, but is this the entire retention story?
- What about backups, audit logs, or data in replicas?
- Is 90 days a business requirement or operational default?
- **Recommendation**: Clarify retention policy scope and validate backup compliance

### Restore Recovery Testing
- `scripts/restore-check.sh` disabled since 2026-05-02 due to CI timeout
- No way to verify backup restoration works
- **Risk**: Backups may be corrupted; unknown whether recovery would succeed
- **Recommendation**: Re-enable or replace with faster restore verification

### API Stability / Breaking Changes
- No version prefix (e.g., `/v1/orders`); changes to schema break clients
- Returning `rows[0]` after insert assumes exactly one row—what if query succeeds but returns empty?
- **Recommendation**: Verify this is intentional; consider API versioning for rolling deployments

### Production Deployment Context
- No documented SLA, error budgets, or alerting strategy
- Retention workflow runs nightly; does the 90-day window have buffer before data deletion?
- No observability (logging, metrics, tracing) in the code

## Recommendations

### Before Platform Handoff (Blocking)
1. **Add authorization**: Implement authentication and verify the request user can access the requested `customerId`
2. **Validate totalMinor range**: Reject `totalMinor ≤ 0`
3. **Validate customerId type**: Ensure it's a positive integer
4. **Add error handling**: Catch pool errors and return 500 with a generic message; validate DATABASE_URL on startup
5. **Add integration tests**: Test `listOrders` and `createOrder` against a test database; verify authorization works

### Before Initial Production Run
6. **Re-enable restore checks**: Verify backup restoration works or implement a faster alternative
7. **Document retention policy**: Clarify scope (backups, replicas, audit trails) and confirm 90-day window is intentional
8. **Clarify API versioning**: Decide if schema changes will be versioned or if backward compatibility is required
9. **Add observability**: Minimal logging for errors and slow queries; emit metrics for request count/latency

### Nice-to-Haves (Non-Blocking)
- Add API versioning prefix (e.g., `/v1/orders`)
- Document expected customer ID range and authorization model in README
- Add structured logging with request IDs for debugging

## Summary

The orders service has a solid foundation (SQL injection protection, parameterized queries, backwards-compatible migrations). However, **it lacks authorization at the trust boundary**, which is a critical security flaw before platform handoff. Input validation is incomplete (no range checks, missing customer ID type validation). Test coverage is minimal—only the formatting utility is tested; the API and database layer are unverified. The disabled restore check is a recovery risk. These issues should be addressed before handing to the platform team.

### Verified
- ✅ Parameterized SQL queries prevent injection
- ✅ Input validation present at API boundary (presence and type checks for customerId and totalMinor)
- ✅ Formatting utility tested and working correctly
- ✅ Data migrations are backwards-compatible
- ✅ Retention policy documented and scheduled
- ❌ Authorization is **missing**; authorization checks are **not present**
- ❌ Integration or API tests **not present**
- ❌ Input range validation **not present** (negative totals, customer ID type)
