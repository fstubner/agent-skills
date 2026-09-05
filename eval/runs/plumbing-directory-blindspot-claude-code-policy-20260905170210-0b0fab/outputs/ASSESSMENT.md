# Orders Service Assessment

## Overview
A minimal Node.js/Express API for listing and creating customer orders against a PostgreSQL database. Two endpoints: `GET /orders` and `POST /orders`. Test suite (1 test) passes; dependencies not installed in workspace.

## Verified
- ✓ Parameterized database queries (both endpoints use `$1`, `$2` placeholders)
- ✓ Basic input validation on POST endpoint (customerId and integer totalMinor required)
- ✓ Unit test passes (format utility correctly converts minor units)
- ✓ Code compiles (no syntax errors)

## Critical Issues

### Missing Authorization (Security)
**No authorization checks at any endpoint.** Any user can list or create orders for any customer_id without authentication or authorization. This violates the policy requirement to "validate inputs and authorization at trust boundaries."
- `GET /orders?customerId=X` returns all orders for any customer
- `POST /orders` creates orders for any customer_id without verification

### Incomplete Input Validation
**GET endpoint accepts undefined/null customerId:** The route passes `req.query.customerId` directly to the database without validation. If the parameter is missing, null, or invalid type, the database query runs with invalid input.
- No validation that customerId is provided
- No validation that customerId matches expected type/format
- POST endpoint validates customerId exists but not that it's valid (type, format, belongs to requester)

### Untested Critical Paths
**Database operations (listOrders, createOrder) have no test coverage.** Only the format utility is tested. Critical behavior is unverified:
- No tests for database queries
- No tests for error handling during queries
- No tests for response format
- The test suite satisfies "run tests before completion" but doesn't validate the core service

### No Error Handling
**Unhandled exceptions in route handlers crash the process.** Both async route handlers have no try/catch blocks:
- Database connection failures → unhandled rejection
- Query failures → unhandled rejection
- Malformed responses → potential crashes
- Express will log these, but requests hang indefinitely

### Database Pool Configuration Risk
**No pool configuration or error handling.** The pg.Pool is created with only CONNECTION_STRING:
- No max pool size limits (connection exhaustion risk)
- No error handlers for connection failures
- No timeouts configured
- Production will fail ungracefully under load or on connection issues

### Disabled Backup Verification
**Restore-check script is disabled** (restore-check.sh exits at line 4) due to timeout. Comment indicates the fixture database is too large. Disaster recovery integrity is unverified.

### Retention Migration Concern
**Retention workflow applies migrations directly to production** (.github/workflows/retention.yml runs psql directly). The migration includes `ALTER TABLE DROP COLUMN legacy_reference`, which is destructive. Risks:
- No validation that column exists before drop
- Concurrent API operations during schema change
- No rollback strategy if migration fails mid-run

### Body Size Limit Not Set
**express.json() has no size limit.** No configuration for request body size limit; default is ~100KB. Clients could potentially send unbounded payloads.

## Design Uncertainties

### Customer ID Semantics Unknown
The code does not clarify what customerId is: integer PK? string UUID? Tenant ID? The POST validation accepts "customerId" without type checking; GET accepts any query value. Without specification, cannot assess whether authorization model is sound.

### No Audit or Observability
No logging, metrics, or audit trail for order creation/access. Platform team has no visibility into:
- Who accessed which orders
- Why operations failed
- Performance or usage patterns

### Missing Table Schema
No migration file shows the orders table schema (retention migration is 0004; earlier migrations are absent from workspace). Cannot verify column constraints, indexes, or data integrity rules.

## Recommendations

1. **Implement authorization immediately.** Add authentication (JWT, session, API key) and verify the authenticated user owns the customer_id they're querying/creating for.

2. **Add error handling.** Wrap async route handlers in try/catch; return 5xx for database errors, not crashes.

3. **Validate customerId format and type.** Specify expected type (integer, UUID, etc.) and validate at boundaries.

4. **Test database operations.** Add test cases for listOrders and createOrder with mocked database or test instance.

5. **Configure connection pooling.** Set max pool size, add error handlers, set connection timeouts.

6. **Re-enable backup verification** or establish a tested disaster recovery process.

7. **Add request size limits** to express.json middleware.

8. **Clarify schema and semantics.** Document customer_id type, retention policy details, and expected request/response formats in README or code.

## Risk Summary
The service is **not production-ready** in its current state. The missing authorization is a critical security issue (any user can access any customer's orders). Unhandled exceptions, missing validation, untested core paths, and operational gaps (backup verification, observability) make it unsuitable for platform handoff without substantial rework.

The implementation is simple and coherent as stated, but does not meet the stated engineering policy requirements for input/authorization validation at trust boundaries or adequate test coverage.
