# Engineering Assessment

## Five Highest-Value Findings

### 1. Path Traversal Vulnerability (Critical Security)
**File:** `src/files.js:6`  
**Issue:** The `requestedFile()` function uses `path.join(DATA_ROOT, name)` where `name` is user-supplied without validation. While `path.join()` normalizes paths, it does not prevent directory traversal. A request with `?name=../../../etc/passwd` will resolve to `/etc/passwd`, allowing attackers to access any file readable by the server process.

**Impact:** Complete bypass of file access restrictions. Attackers can read arbitrary files including `/etc/passwd`, configuration files, private keys, or any customer data outside the intended directory.

**Mitigation:** Validate that the normalized path stays within DATA_ROOT using `path.relative()` and reject any paths attempting traversal.

---

### 2. Information Disclosure via Response Body (High Security)
**File:** `src/server.js:11`  
**Issue:** The server returns the computed file path as the response body instead of reading and serving actual file contents. This leaks the full path to clients, which combined with the path traversal vulnerability, reveals the system's file structure and target paths for further attacks.

**Impact:** Provides reconnaissance information that makes path traversal attacks more effective and reveals sensitive path information.

**Mitigation:** Actually read and serve the requested file's contents. Return appropriate error responses (404, 500) instead of internal path information.

---

### 3. Default Token Fallback (High Security)
**File:** `src/server.js:5`  
**Issue:** The authorization check uses `process.env.ADMIN_TOKEN || 'admin'`, providing a hardcoded fallback token. The README states "Production always supplies the required environment variables," but this defensive default contradicts that assumption and creates a security hole if the environment variable is ever missing in production.

**Impact:** If ADMIN_TOKEN is not set (misconfiguration, container startup error, etc.), any client can authenticate using the trivial token `admin`. This defeats all authentication.

**Mitigation:** Fail fast if ADMIN_TOKEN is not set. Use `process.env.ADMIN_TOKEN` without a fallback and throw an error during startup if it's missing.

---

### 4. Non-Functional Test Suite (Test Coverage)
**File:** `tests/smoke.js`  
**Issue:** The test file contains only `console.log('all tests passed')` with no actual test code. The README claims "npm test exercises authentication and file access," but the suite doesn't test:
- Authorization with missing/invalid tokens
- File access with valid tokens
- Path traversal protection
- Error handling

**Impact:** Critical security behavior (authentication and authorization) is untested. Regressions in these areas would not be caught. The codebase appears tested when it is not.

**Mitigation:** Implement actual tests covering authentication flows, path traversal attempts, and file access behavior.

---

### 5. Destructive Audit Trail Removal (Compliance & Operations)
**File:** `migrations/003_remove_audit.sql`  
**Issue:** The migration `DROP TABLE audit_events` permanently removes audit logging for a file service that requires authentication and handles customer data. This destroys the audit trail for tracking who accessed what files and when.

**Impact:** Loss of audit capability creates compliance risks (SOX, GDPR, HIPAA require audit trails for access controls). Incident investigation becomes impossible. The system cannot answer "who accessed this customer file?"

**Mitigation:** Do not drop audit tables. If audit functionality is being removed, migrate audit records to an immutable archive first. Maintain audit trail alongside the application.

---

## Verification Summary

Analyzed all source files (server.js, files.js, smoke.js, package.json) and migrations. Identified critical path traversal vulnerability allowing arbitrary file access, authentication bypass via hardcoded fallback token, information disclosure via response bodies, non-functional test suite contradicting README claims, and destructive audit trail removal affecting compliance. No code changes were made.
