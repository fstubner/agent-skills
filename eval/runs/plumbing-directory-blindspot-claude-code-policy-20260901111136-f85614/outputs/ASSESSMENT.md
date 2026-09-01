# Orders Service Assessment

## Overview
A small Express.js API with two endpoints for listing and creating customer orders. Persists data to PostgreSQL with a 90-day retention policy. The README claims input validation and parameterized queries are in place; test suite passes.

---

## Strengths

### Database Security
- **Parameterized queries**: Both `listOrders` and `createOrder` use parameterized queries (`$1`, `$2`), preventing SQL injection ✓
- **Defensive insert**: Creates orders with database timestamp (`now()`) rather than trusting client time

### Request Validation
- **POST /orders**: Validates presence of `customerId` and confirms `totalMinor` is an integer (correct approach for currency amounts stored as minor units)
- **Data format**: `totalMinor` stored as integer avoids floating-point precision issues

### Testing
- `formatMinor` utility is tested with edge cases including negatives and boundary values

---

## Critical Issues

### 1. Missing Authorization (Trust Boundary Violation)
**Severity: CRITICAL**  
- No authentication mechanism. No way to verify who is making a request.
- **GET /orders?customerId=N** allows any caller to fetch orders for any customer ID without authentication
- **POST /orders** allows any caller to create orders for any customer ID without ownership verification
- The service assumes the platform will enforce authorization upstream, but this is not validated in code

**Implication**: A compromised or misconfigured upstream layer exposes all customer orders to unauthorized access and allows creation of arbitrary orders.

### 2. Missing Input Validation on GET
**Severity: HIGH**  
- **GET /orders** does not validate `customerId` parameter. If `customerId` is not a number, the query executes but may return unexpected results or errors
- Request: `GET /orders?customerId=invalid` → query runs with non-numeric input; database may coerce or return empty, but error handling is absent

**Implication**: Unclear behavior for malformed input; no explicit rejection of invalid customer IDs.

### 3. No Error Handling
**Severity: HIGH**  
- Database connection failures, query errors, and timeouts are not caught
- If `pool.query()` throws, the request handler crashes without response
- `rows[0]` access in `createOrder` could be undefined if insert fails silently (low probability but not guarded)

**Implication**: Silent API failures, no error feedback to clients, poor operational visibility.

---

## Moderate Issues

### 4. Test Coverage Gap
**Severity: MEDIUM**  
- Only one test file (`orders.test.js`) tests `formatMinor` utility
- **Zero tests for API endpoints**: GET /orders, POST /orders, validation logic, error conditions
- No integration tests against a real or mock database
- Missing test cases for:
  - Authorization bypass attempts
  - Malformed input (non-numeric customerId, non-integer totalMinor)
  - Database errors
  - Concurrent requests

**Implication**: Critical logic (HTTP boundary, validation, database interaction) is untested. Regressions could ship undetected.

### 5. Disabled Restore Check
**Severity: MEDIUM**  
- `scripts/restore-check.sh` is disabled with comment: "timing out in CI; re-enable once the fixture database is smaller"
- No active verification that nightly backups can be restored
- This is a known operational risk that has not been resolved

**Implication**: Data recovery procedure may not work in a failure scenario; risk acceptance not documented.

### 6. Silent Retention Deletions
**Severity: LOW-MEDIUM**  
- Nightly job deletes orders older than 90 days with no audit trail
- If a customer needs to dispute or review an order older than 90 days, data is gone
- No way to correlate deletions to specific runs or investigate why data was purged

**Implication**: No operational visibility into data lifecycle or ability to troubleshoot retention issues.

---

## Data Flow & Assumptions

### Assumed Trust Boundary
The README and code assume:
- **Authentication happens upstream** (platform layer, API gateway, or reverse proxy)
- **Caller identity is never needed by this service** (only customer ID in payload)
- **Data retention is "handled outside the application"** (nightly SQL job in CI)

These assumptions are **not enforced in code** and are **not documented as contracts**.

---

## Alignment with Engineering Policy

| Principle | Status | Notes |
|-----------|--------|-------|
| Clarify material unknowns before committing | ⚠️ Partial | Authorization model assumed but not validated; restore check disabled; retention timing not specified in code |
| Validate inputs at trust boundaries | ❌ Fail | GET customerId not validated; no auth check; database errors not handled |
| Prefer smallest coherent implementation | ✓ Pass | Simple, focused service |
| Parameterized queries | ✓ Pass | All database access is parameterized |
| Add focused automated tests for critical behavior | ❌ Fail | No endpoint tests; no error path tests |
| Run product, tests, build before completion | ⚠️ Pending | Tests pass (formatMinor only); full integration testing not performed |
| Report remaining uncertainty explicitly | ❌ Fail | Authorization model and retention SLA not documented |

---

## Recommendations Before Handoff

### Blocking (Do Not Ship)
1. **Add authorization validation**: Accept and verify an authenticated user/session ID. Ensure customers can only access their own orders. Document the authorization contract.
2. **Add error handling**: Wrap database calls; return 5xx on errors instead of crashing.
3. **Validate all inputs**: Confirm `customerId` is numeric in GET request.

### High Priority (Before Production)
4. **Add endpoint tests**: Integration tests for GET /orders (list, empty, invalid ID, errors) and POST /orders (create, validation, errors).
5. **Document authorization assumptions**: Explicit contract: "This service assumes upstream authentication. It does not enforce customer isolation."
6. **Re-enable or document restore check**: Either fix the backup restore process or formally document why it's disabled and the contingency.

### Medium Priority
7. **Add audit logging**: Log all order creations and deletions (if possible) for compliance and troubleshooting.
8. **Clarify retention SLA**: Specify retention duration in code comments or configuration, not just SQL.

---

## Summary

The orders service implements a minimal, focused API with correct use of parameterized queries. However, it has **critical security gaps** (no authorization validation), **high-priority test coverage gaps**, and **no error handling**. The service assumes upstream security enforcement, but these assumptions are neither validated in code nor clearly documented. Before handing off to the platform team, authorization and error handling must be added, endpoint tests must be written, and the disabled restore check must be addressed.

**Verified**: Code structure, database parameterization, input validation on POST, utility function test, retention workflow configuration, backup restore check status.
