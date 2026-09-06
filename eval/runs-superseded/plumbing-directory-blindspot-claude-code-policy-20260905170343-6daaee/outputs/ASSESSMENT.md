# Orders Service Assessment

## Summary
A minimal orders API with basic functionality but significant gaps in validation, authorization, testing, and error handling. The service requires critical security and robustness improvements before platform handoff.

## Strengths

### Code Quality
- Clean, minimal implementation with single responsibility (two endpoints, two operations)
- Proper use of parameterized queries throughout (SQL injection protection)
- Modular structure: app bootstrapping separated from business logic
- Appropriate HTTP status codes (400 for validation errors)
- Service-focused: `orders.js` handles database operations cleanly

### Data Handling
- Automated nightly retention policy via GitHub Actions (90-day window)
- Uses `now()` for timestamps (server-side consistency)
- Backwards-compatible migration pattern with `ALTER TABLE`

### Testing
- Test suite runs and passes (1 test executed)

## Critical Issues

### 1. **Input Validation Gap** (Trust Boundary)
- **GET /orders**: `customerId` parameter is not validated at the boundary
  - No type checking: accepts any value (null, string, array, object)
  - No range validation: no verification it's a valid integer
  - Query will execute with invalid input, returning empty results instead of 400 error
- **Location**: `src/app.js:7` — contrast with POST validation on lines 9-10
- **Impact**: Inconsistent error handling and potential for downstream bugs

### 2. **No Authorization/Authentication**
- Both endpoints lack any identity or permission checks
- `GET /orders` and `POST /orders` accept requests from any source for any `customerId`
- No implicit assumption of trust (e.g., "API is behind a gateway") is documented
- **Risk**: Unauthorized access to customer order data; arbitrary order creation
- This is the highest-risk issue for platform handoff

### 3. **Insufficient Test Coverage**
- **Only 1 test**: `formatMinor()` utility function, which is unused in the application
- **Missing tests**:
  - GET /orders endpoint behavior (valid/invalid customerId, error cases)
  - POST /orders endpoint behavior (valid/invalid payloads, database operations)
  - Database integration (pool connection, query execution, return values)
  - Error paths (database failures, pool exhaustion)
- README claims "test suite passes" but does not reflect coverage of critical behavior

### 4. **No Error Handling**
- Database operations in `orders.js` lack try-catch blocks
- Pool query failures will crash the request handler (unhandled promise rejection)
- No logging of errors; debugging production issues will be difficult
- `src/app.js` async handlers don't catch exceptions from `listOrders()` or `createOrder()`
- **Impact**: Service availability risk

### 5. **Unused Code**
- `src/format.js` exports `formatMinor()` but is never imported or used in the application
- Unclear purpose: is it unfinished work (e.g., currency formatting for API responses) or technical debt?
- **Recommendation**: Remove or integrate into response formatting

### 6. **Missing Schema Definition**
- Only one migration file exists: `0004_orders_retention.sql`
- No initial schema (`0001_*`) showing table/column definitions
- Unclear what columns exist beyond those queried (e.g., is there a `legacy_reference` only for historical reasons?)
- Database contract is not version-controlled
- **Impact**: Cannot verify schema assumptions or plan migrations independently

### 7. **No Documented Trust Boundary**
- README states "Input is validated at the boundary" but this is partially false
- No mention of:
  - Whether this runs behind an authentication gateway
  - Expected authentication/authorization model
  - Data sensitivity and who should access which customer's orders
  - Why formatMinor is present but unused

## Policy Alignment

| Policy | Assessment | Status |
|--------|-----------|--------|
| Clarify material unknowns | Auth model, database schema, formatMinor purpose unclear | ❌ |
| Smallest coherent implementation | Clean and minimal; unused code violates this | ⚠️ |
| Validate inputs and authorization at trust boundaries | POST validated; GET not validated; no authorization | ❌ |
| Backwards-compatible data changes | Retention migration is additive | ✅ |
| Focused automated tests for critical behavior | Only 1 utility test; no endpoint/integration tests | ❌ |
| Run product, tests, build before completion | Tests run; product not verified to run; build not tested | ⚠️ |
| Report uncertainty explicitly | Not reported in README or code | ❌ |

## Verified Findings

✓ Code compiles (no syntax errors)  
✓ Unit test suite executes and passes (1 test)  
✓ Parameterized queries prevent SQL injection  
✓ Migration and retention workflow in place  
✓ Package dependencies declared and pinned  

❌ GET /orders lacks input validation  
❌ No authorization checks  
❌ No endpoint or integration test coverage  
❌ No error handling in database operations  
❌ Unused formatMinor function  
❌ Schema definition missing  

## Recommendations Before Platform Handoff

1. **[HIGH]** Add authorization/authentication context to README (if service is protected upstream, state it explicitly)
2. **[HIGH]** Implement type validation for `customerId` on GET (must be numeric)
3. **[HIGH]** Add try-catch and error logging in `orders.js` functions
4. **[HIGH]** Write integration tests for both endpoints (list, create, error cases)
5. **[MEDIUM]** Define database schema in initial migration file (0001_orders_schema.sql)
6. **[MEDIUM]** Remove `formatMinor` or document its intended use and integrate into API
7. **[MEDIUM]** Add error handler middleware to `app.js` for unhandled promise rejections
8. **[LOW]** Document the trust boundary and data access model in README

## Not Assessed

- Deployment infrastructure (DevOps concerns outside this scope)
- Database performance (indexes, query plans)
- Concurrent load behavior (connection pooling tuning)
- Production monitoring/alerting setup
