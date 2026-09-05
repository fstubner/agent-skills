# Orders Service Assessment

## Summary
The orders service implements two endpoints (list and create) with correct parameterized SQL queries and valid syntax. Core functionality for minor units formatting works. However, critical authorization gaps and incomplete testing present risks for production handoff.

## Strengths

**Input validation at boundary.** The app.js validates presence of `customerId` and integer type for `totalMinor` at request entry.

**SQL injection protection.** All queries use parameterized statements ($1, $2), eliminating SQL injection risk.

**Data retention architecture.** Retention is handled outside the application via scheduled workflow, decoupling concerns cleanly.

**Minor units formatting.** The formatMinor function correctly handles edge cases (negatives, fractional cents) with passing tests.

## Critical Issues

### 1. No Authorization (Trust Boundary)
**Risk:** Any client can list or create orders for any customer ID.

The endpoints accept arbitrary `customerId` values without validating that the requester owns that customer. A user can call `/orders?customerId=999` to read another customer's orders, or `POST /orders` with any customer ID to create fraudulent orders.

**Why it matters:** This violates the policy requirement to "validate inputs and authorization at trust boundaries." The customerId is a cross-customer boundary.

**Unknowns:** How should authentication/authorization be handled? (JWT token, session, API key, internal service token?) What is the customer ID—a user ID, account ID, or separate entity? These should be clarified before platform handoff.

### 2. Missing Error Handling
**Risk:** Unhandled database errors leak to clients.

Both `listOrders` and `createOrder` have no error handling. If the database is unavailable, queries fail, or the INSERT violates constraints, the raw error is returned to the client, potentially revealing schema details or connection strings from stack traces.

**Example:** If `placed_at` column is missing, or database is down, Express will return a 500 with the full error trace.

**Incomplete validation:** `listOrders` doesn't check if `customerId` is null/undefined before querying. If omitted, it may return all orders (depends on PostgreSQL behavior with NULL in WHERE).

### 3. Weak Test Coverage
**Risk:** API endpoints and database operations untested.

Only one test exists (formatMinor). No tests cover:
- GET /orders endpoint behavior
- POST /orders endpoint behavior  
- Database interaction
- Error conditions (bad input, missing columns, connection failures)
- Authorization scenarios

**Database schema unknown:** No migration files provided for the orders table structure. The queries assume `id`, `customer_id`, `total_minor`, `placed_at` columns exist, but this is not verified.

### 4. Data Changes Not Backwards-Compatible
The retention migration (0004_orders_retention.sql) includes `ALTER TABLE orders DROP COLUMN legacy_reference`. This assumes the column exists and was previously used. If this migration is new, the column reference suggests a backwards-incompatible change that may break existing clients expecting that field.

Unclear if this is an active concern or a past cleanup, but the migration lacks context.

### 5. Response Format Inconsistency
- GET returns `{ orders: [...] }`  
- POST returns the order object directly

This inconsistency may confuse clients. POST should probably return `{ order: {...} }` or both should use a consistent envelope.

### 6. Unspecified Constraints
No validation of business logic:
- Can `totalMinor` be negative? (Not rejected, but may be invalid for pricing.)
- Can `totalMinor` be zero? (Not rejected.)
- What is the maximum value?

## Verification Checklist

- ✅ Syntax valid (node -c)
- ✅ Tests pass (`npm test`)
- ✅ Dependencies declared (package.json)
- ✅ Parameterized queries (no SQL injection)
- ✅ Input type validation present
- ❌ Authorization checks present
- ❌ Error handling for database failures
- ❌ API endpoint tests
- ❌ Database schema verified
- ❌ Rolling deployment safety confirmed
- ⚠️ Response format consistency

## Remaining Uncertainties (Material Unknowns)

1. **Authentication/authorization design:** Who should be allowed to call these endpoints? How should customer ownership be verified?
2. **Database schema:** What columns exist on the orders table? Are there constraints (NOT NULL, CHECK, FOREIGN KEYS)?
3. **Error handling strategy:** Should errors be logged internally and generic 500s returned to clients? Should certain errors return specific status codes?
4. **Response envelope:** Should both endpoints follow a consistent response structure?
5. **Business logic:** What are valid ranges for `totalMinor`? Should it be positive-only?

## Recommendation

**Do not hand to platform team without addressing authorization.** The missing auth check is a security boundary violation. Clarify:
- How requests are authenticated (JWT, session, service token)
- How customer ownership is validated
- Whether customerId is user-provided or derived from auth context

Add error handling to prevent uncontrolled error propagation. Expand test coverage to at least the happy path for both endpoints.

Once those are addressed, the implementation is reasonably sound for a foundational service.
