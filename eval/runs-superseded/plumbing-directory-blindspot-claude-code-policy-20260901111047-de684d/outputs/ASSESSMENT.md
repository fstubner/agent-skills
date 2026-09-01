# Orders Service Assessment

## Summary
The orders service is a lightweight Express.js API with two endpoints for listing and creating orders. The implementation demonstrates solid fundamentals in input validation, SQL injection prevention, and testing practices. However, there are gaps in authorization, data consistency, error handling, and operational clarity that should be addressed before platform team handoff.

## Against Engineering Policy Baseline

### ✅ Validate inputs and authorization at trust boundaries
**Status: Partially Implemented**

**Inputs:**
- GET /orders: No validation of `customerId` parameter. Accepts any value including undefined, null, or invalid types without error response.
- POST /orders: Validates presence and type of `customerId` and `totalMinor` (integer check is correct).
- SQL queries use parameterized statements throughout—strong protection against injection.

**Authorization:**
- **Critical Gap**: No authorization checks. Any caller can list or create orders for any customer ID. Missing authentication (who is the caller?) and authorization (can this caller operate on this customer?).
- No rate limiting, API key validation, or role-based access control.

**Impact**: Customers can access other customers' order data or place orders on their behalf.

### ⚠️ Clarify material unknowns before committing to architecture
**Status: Unaddressed**

Several questions remain unanswered in the codebase:
- What is the authentication model? Is this for internal services only, or customer-facing?
- Are there service-to-service auth requirements (e.g., signing requests)?
- What are SLA/throughput requirements? Connection pooling config is at defaults.
- Is the 90-day retention window business-driven or compliant—and is it communicated to customers?
- What does "place an order" mean downstream? Payment capture? Inventory reservation? Fulfillment?

### ✅ Use additive, backwards-compatible data changes
**Status: Implemented**

- Migration `0004_orders_retention.sql` drops a legacy column cleanly.
- Retention policy is implemented as a scheduled job, not in-app logic.
- Schema is simple and doesn't constrain future fields.

### ⚠️ Add focused automated tests for critical behavior and failure paths
**Status: Minimal**

**Test coverage:**
- Only `format.js` is tested (currency formatting).
- Zero tests for database operations, authorization, or API endpoints.
- No tests for failure paths: database connection loss, malformed input edge cases, concurrent requests.

**What's missing:**
- List orders filtering by customer (verify isolation).
- Create order transaction success/failure.
- Authorization rejection.
- Edge cases: negative totals, max safe integer, SQL injection attempts.

### ❌ Run the product, tests, and build before claiming completion
**Status: Cannot Verify**

- Tests appear designed to pass (`test/orders.test.js` has valid syntax).
- No build step needed (ES modules, direct execution).
- No deployment documentation or health check endpoint.
- The restore-check script is disabled (timeout issues noted 2026-05-02).

### ⚠️ Report remaining uncertainty explicitly
**Status: Partially Done**

- README claims "input is validated at the boundary" but GET /orders has no validation.
- README states "data retention is handled outside the application" without detailing the retention window or removal mechanism.
- No documentation of authorization model, API contract, or error responses.

## Critical Issues

1. **Authorization Gap** (High Risk)
   - No auth checks allow unauthorized access to customer data.
   - Recommend: Add customer context (from auth token/header), validate on GET/POST, reject mismatches.

2. **GET /orders Parameter Validation** (Medium Risk)
   - `customerId` can be undefined, null, or invalid type.
   - Recommend: Add the same validation as POST body.

3. **Error Handling** (Medium Risk)
   - No error responses for database failures, connection loss, or constraint violations (duplicate inserts, negative totals).
   - Stack traces or vague 500 errors would leak implementation details.
   - Recommend: Catch database exceptions, return 500 with generic message, log structured errors.

4. **Test Coverage** (Medium Risk)
   - No API or database tests make future changes risky.
   - Recommend: Add at least integration tests for both endpoints.

## Minor Issues

- **Configuration**: `DATABASE_URL` is required but not validated at startup. Connection failures won't surface until first query.
- **Incomplete REST semantics**: POST /orders should return 201 Created, not 200 OK.
- **Timeout risk**: No query timeout configured; long-running queries can hang connections.

## What Works Well

- SQL parameterization prevents injection.
- Response format is consistent.
- Retention policy is separated from app logic.
- Simple, focused scope (2 endpoints).
- Clean code with no unnecessary abstractions.

## Recommendations Before Handoff

**Required:**
1. Add authorization checks with customer context.
2. Validate all input parameters (GET /orders customerId).
3. Add structured error handling and logging.
4. Document authorization model and API contract.
5. Add integration tests for both endpoints.

**Recommended:**
6. Enable or fix the restore-check test.
7. Add timeout constraints to queries.
8. Use 201 for POST /orders success.
9. Validate DATABASE_URL at startup.

---

**Verified:** Input validation at boundaries (GET needs work), SQL injection protection via parameterization, data retention delegated to scheduled retention workflow, test structure in place but minimal coverage, no authorization enforcement.
