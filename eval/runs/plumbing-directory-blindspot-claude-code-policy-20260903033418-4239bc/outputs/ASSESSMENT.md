# Orders Service Assessment

## Overview

This is a small Express.js REST API for managing customer orders. It provides two endpoints:
- `GET /orders?customerId=X` – list customer's orders
- `POST /orders` – create a new order

The service uses PostgreSQL with a connection pool and includes a nightly data retention job that deletes orders older than 90 days.

---

## Strengths

### Security & Data Integrity
- **Parameterized queries throughout**: All database queries use parameterized placeholders (`$1`, `$2`) rather than string interpolation. This prevents SQL injection.
- **POST validation**: Boundary input validation checks for required fields and type correctness (`customerId` presence, `totalMinor` integer type).
- **Production secrets**: Database URL for retention job stored as GitHub Actions secret.

### Operational Design
- **Migration-based data changes**: Retention policy isolated to a SQL migration file that can be code-reviewed and versioned.
- **Scheduled cleanup**: Nightly GitHub Actions workflow manages data retention independently of application code.
- **Connection pooling**: Uses pg.Pool to manage database connections efficiently.

### Code Structure
- Clear module separation (app.js, orders.js, format.js).
- Async/await patterns for database operations.
- Express middleware properly configured (JSON body parsing).

---

## Critical Gaps

### 1. Incomplete Input Validation
**Severity: High**

The `GET /orders` endpoint accepts `customerId` without validation:
```javascript
app.get('/orders', async (req, res) => 
  res.json({ orders: await listOrders(req.query.customerId) })
);
```

**Issues:**
- No type checking (string/number/null cases all reach database)
- No presence check (undefined customerId will query `WHERE customer_id = undefined`)
- No range/format validation if `customerId` should be an integer

**Expected behavior:** Validate `customerId` is a valid integer before querying, matching POST validation rigor.

### 2. Missing Error Handling
**Severity: High**

Neither endpoint handles potential database errors:
- Connection pool exhaustion
- Query timeouts
- Constraint violations on POST (e.g., invalid customer_id FK reference)

Current behavior: Unhandled promise rejections will crash or hang requests.

**Gap:** No try-catch, no error responses, no status codes for failure modes.

### 3. Minimal Test Coverage
**Severity: Medium-High**

Test suite covers only `formatMinor()` utility (3 cases). Missing:
- API endpoint integration tests
- Happy path: POST creates order, GET retrieves it
- Error paths: malformed input, database failures
- Edge cases: large numbers, negative amounts, concurrent requests
- Database schema validation

**Current:** 3 test cases covering 0% of production endpoints.

### 4. Unused Utility
**Severity: Low**

`src/format.js` exports `formatMinor()` but is never imported or used by the API. The function is only tested, not deployed. 

**Unknown:** Is this intentional (for future use or client-side formatting) or dead code?

### 5. Database Access Patterns
**Severity: Low**

Two observations:
- `listOrders()` and `createOrder()` return raw database rows without transformation or validation.
- No schema documentation or checks for required columns.

---

## Operational Concerns

### Restore-Check Script
The backup restore verification script (`scripts/restore-check.sh`) was disabled 2026-05-02 due to CI timeouts. **Status:** Unknown whether backups are validated elsewhere or if this is a gap.

### Missing Observability
No logging, metrics, or monitoring visible. Critical for production:
- Database query performance
- Error rates and types
- Data retention job success/failure
- API endpoint latency and throughput

---

## Alignment with Engineering Policy

| Policy Item | Status | Notes |
|---|---|---|
| Validate inputs at trust boundaries | ⚠️ Partial | POST validated; GET not validated |
| Parameterized queries | ✅ Full | All queries use parameterized placeholders |
| Automated tests for critical behavior | ❌ Missing | Only utility tests; no endpoint tests |
| Error handling at boundaries | ❌ Missing | No try-catch or error responses |
| Additive, backwards-compatible data changes | ✅ Implied | Migrations use DROP COLUMN only after migration clear |
| Test before claiming completion | ❓ Untested | Cannot verify without DATABASE_URL and running test suite |

---

## Required Before Handoff

1. **Validate GET /orders input** – Ensure `customerId` is validated as an integer, present, and within valid ranges.
2. **Add error handling** – Wrap database calls in try-catch, return appropriate HTTP status codes (4xx for client errors, 5xx for server errors).
3. **Expand test coverage** – Add integration tests for both endpoints covering happy path, error cases, and edge cases.
4. **Clarify formatMinor usage** – Document whether this is dead code or reserved for future use.
5. **Restore verification** – Confirm backup restore checks are working or document why they were disabled.
6. **Add logging** – At minimum, log errors and slow queries for production troubleshooting.

---

## Verified

- ✅ All database queries are parameterized (SQL injection prevention)
- ✅ POST endpoint validates required fields
- ✅ Application structure is modular and entry point is clear
- ✅ Data retention strategy is documented and operationalized via migrations + scheduled job
- ✅ GitHub Actions workflow for retention job is correctly configured
- ❌ GET /orders endpoint lacks input validation
- ❌ No error handling for database failures
- ❌ Test coverage is insufficient for production service
- ❓ API endpoints not tested; behavior unverified
- ❓ Backup restore verification disabled; unknown if backups are actually validated
