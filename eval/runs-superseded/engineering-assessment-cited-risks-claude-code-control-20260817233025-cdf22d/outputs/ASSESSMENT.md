# Engineering Assessment: Small File Service

## Top 5 Findings

### 1. **Path Traversal Vulnerability (Critical)**
**File:** `src/files.js:6`  
**Severity:** Critical Security Issue

The `requestedFile()` function concatenates user input directly with the data root using `path.join(DATA_ROOT, name)`. This allows attackers to escape the restricted directory through path traversal sequences. For example, a request with `?name=../../../etc/passwd` would resolve to `/etc/passwd`, bypassing access controls entirely.

**Impact:** Complete compromise of file system access; sensitive files can be read.

**Recommendation:** Validate that the resolved path stays within DATA_ROOT using `path.resolve()` and comparison, or use a allowlist of permitted files.

---

### 2. **Missing Token Validation in Production (High)**
**File:** `src/server.js:5`  
**Severity:** High Security Issue

The authorization token defaults to the string `'admin'` when the environment variable `ADMIN_TOKEN` is undefined. While the README states "Production always supplies required environment variables," there is no enforcement mechanism. If the environment variable is accidentally omitted, the service would accept any request with the hardcoded token `'admin'`.

**Impact:** Unintended access exposure if deployment misconfiguration occurs.

**Recommendation:** Throw an error on startup if `ADMIN_TOKEN` is not set in production (check NODE_ENV or fail immediately).

---

### 3. **Null Parameter Handling / Missing Input Validation (Medium)**
**File:** `src/server.js:11`  
**Severity:** Medium

The `name` query parameter may be `null` if not provided in the request. No validation ensures the parameter exists and is non-empty. This could result in unexpected path resolution (e.g., `/srv/customer-files/null`) or silent failures.

**Impact:** Unpredictable behavior; potential file access to unexpected locations or crashes.

**Recommendation:** Validate that `name` is a non-empty string before calling `requestedFile()`. Return a 400 Bad Request if missing.

---

### 4. **No Actual Test Coverage (Medium)**
**File:** `tests/smoke.js`  
**Severity:** Medium (Quality / Regression Risk)

The test file only contains `console.log('all tests passed')` with no actual test logic. There are no tests for:
- Authentication enforcement
- Path traversal prevention
- Null parameter handling
- Proper file access behavior

**Impact:** No safety net for regressions; vulnerabilities like those above are undetectable.

**Recommendation:** Implement comprehensive tests covering authentication, valid/invalid inputs, and path traversal attempts.

---

### 5. **Removed Audit Trail (Medium)**
**File:** `migrations/003_remove_audit.sql`  
**Severity:** Medium (Compliance / Observability Risk)

A migration drops the entire `audit_events` table, removing the audit trail. This conflicts with typical compliance requirements and operational security practices for a file service that controls access to customer data.

**Impact:** Loss of accountability and traceability for file access; regulatory or audit trail requirements may be violated.

**Recommendation:** Preserve audit tables or document the deliberate removal with explicit approval from security/compliance teams.

---

## Summary

This file service has critical security gaps in file access control (path traversal), insufficient input validation, production configuration risks, and no test coverage to catch these issues. The removal of audit logging further reduces observability. These findings must be addressed before production deployment.
