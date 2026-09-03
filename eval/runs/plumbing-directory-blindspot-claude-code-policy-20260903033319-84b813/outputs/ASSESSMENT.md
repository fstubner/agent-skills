# Orders Service Assessment

## Summary
The orders service is a minimal Express.js API with two endpoints: list orders and create orders. It follows some good practices (parameterized queries, input validation at boundaries) but has several gaps against the engineering policy baseline.

## Findings

### ✓ Strengths

1. **Input Validation at Boundaries**: The `app.js` validates required fields (customerId, totalMinor) at the REST boundary before calling business logic.

2. **SQL Injection Prevention**: Queries use parameterized statements (`$1`, `$2`), protecting against SQL injection.

3. **Minimal, Coherent Implementation**: The service is focused and doesn't over-engineer. It has two endpoints with clear responsibilities.

4. **Environment-Driven Configuration**: Uses `DATABASE_URL` environment variable and `PORT` configuration for flexibility.

5. **Data Retention Strategy**: Nightly retention workflow purges orders older than 90 days via scheduled GitHub Actions job.

### ⚠ Critical Issues

1. **Missing Authorization/Authentication**: The GET `/orders` endpoint accepts any `customerId` query parameter without verifying the requester is authorized to access that customer's data. This is a major trust boundary failure. Any user can list orders for any customer.
   - **Risk**: Unauthorized data exposure
   - **Fix Required**: Implement authentication and verify the requester's identity before returning orders

2. **Incomplete Test Coverage**: The test suite only covers the `formatMinor` utility function. There are no tests for:
   - `listOrders` and `createOrder` business logic
   - HTTP endpoint behavior
   - Database interactions
   - Error cases
   - Query parameterization correctness

3. **No Error Handling**: Database operations (`pool.query`) have no error handling. Connection failures, constraint violations, or timeouts will crash the server.
   - **Risk**: Service unavailability
   - **Expected**: Catch errors and return appropriate HTTP error responses

### ⚠ Data Compatibility Concerns

1. **Breaking Migration**: The migration `0004_orders_retention.sql` drops the `legacy_reference` column without checking if clients still depend on it. If this was recently removed, clients expecting the field will break.
   - **Expected for Rolling Deploy**: An additive-first approach (nullable column, deprecation period) would be safer

2. **Disabled Recovery Script**: The `restore-check.sh` is disabled since 2026-05-02 due to CI timeout. The backup/restore process is currently unverified.
   - **Risk**: Data recovery may fail when needed
   - **Status**: Known, deferred issue

### ⚠ Operational Gaps

1. **No Logging/Observability**: No structured logs for requests, queries, or errors. Difficult to diagnose production issues.

2. **Input Type Assumptions**: The `listOrders` function receives `customerId` from query params (a string) but passes it directly to SQL. If the schema expects an integer, implicit coercion may hide bugs or create unexpected behavior.

3. **formatMinor Unused**: The `formatMinor` utility is tested but not imported or used anywhere in the application. Unclear if it's dead code or intended for future use.

## Assessment Against Engineering Policy

| Policy Point | Status | Notes |
|---|---|---|
| Clarify material unknowns | ⚠ Partial | Authorization model undefined; client expectations unclear |
| Smallest coherent implementation | ✓ | Well-scoped two-endpoint API |
| Validate inputs + authorization at boundaries | ⚠ Partial | Input validation present; authorization completely missing |
| Backwards-compatible data changes | ⚠ Partial | Migration drops column without deprecation period |
| Focused automated tests | ✗ | Only utility function tested; business logic untested |
| Run product, tests, build before completion | ✓ Tests run | `npm test` passes for existing tests; database integration untested |
| Report uncertainty explicitly | ✗ | README claims "test suite passes" without noting coverage gaps |

## Verification Checklist

- [x] Code review completed
- [x] Input validation examined
- [x] SQL queries checked for injection vulnerabilities
- [x] Authorization/authentication assessed
- [x] Test coverage evaluated
- [x] Data retention strategy reviewed
- [x] Error handling checked
- [x] Configuration examined
- [ ] Tests executed (requires environment setup)
- [ ] Service run end-to-end (requires database)

## Recommendation

**Not ready for platform team handoff** without addressing:

1. **Immediate**: Implement authorization checks on the GET `/orders` endpoint
2. **Immediate**: Add error handling to database operations
3. **High Priority**: Expand test suite to cover business logic and error paths
4. **High Priority**: Clarify the `formatMinor` utility—remove if unused or integrate into API responses
5. **Medium Priority**: Enable or fix the restore-check script for backup verification
6. **Medium Priority**: Implement structured logging for operations visibility

The code is architecturally sound but lacks critical security controls and operational robustness needed for a production service.
