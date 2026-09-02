# Engineering Assessment: Small File Service

## Critical Findings

### 1. **Path Traversal Vulnerability in File Serving** [SECURITY-CRITICAL]
**Location:** `src/files.js:6`, `src/server.js:11`  
**Issue:** The `requestedFile()` function concatenates user-supplied input directly to a root path without validation:
```javascript
export function requestedFile(name) {
  return path.join(DATA_ROOT, name);
}
```
An attacker with a valid admin token can supply `../../../etc/passwd` to read arbitrary files outside the intended directory. `path.join()` resolves `..` sequences, enabling directory traversal. This violates "Validate inputs and authorization at trust boundaries."

**Impact:** Complete bypass of file access control. Confidential data leakage.  
**Fix Required:** Reject relative paths (containing `..` or `/`), normalize and verify the resolved path stays within `DATA_ROOT`, or use allowlist-based file selection.

---

### 2. **Weak Authentication with Guessable Default Token** [SECURITY-HIGH]
**Location:** `src/server.js:5`  
**Issue:** The default authorization token is the trivial string `'admin'`:
```javascript
const token = process.env.ADMIN_TOKEN || 'admin';
```
The README states "Production always supplies the required environment variables," but this default undermines that guarantee. If `ADMIN_TOKEN` is ever unset—due to deployment misconfiguration, secret rotation failure, or container startup race—the service falls back to a hardcoded, widely-known default that provides zero security.

**Impact:** Any unauthenticated actor can gain full file access with trivial guessing.  
**Fix Required:** Remove the default fallback entirely. Throw an error if the environment variable is missing; refuse to start without it.

---

### 3. **Inadequate Test Coverage with False Claims** [QUALITY-HIGH]
**Location:** `tests/smoke.js`  
**Issue:** The test file contains only a console.log statement and no actual test logic:
```javascript
console.log('all tests passed');
```
The README claims "`npm test` exercises authentication and file access," but the test performs neither. It unconditionally succeeds regardless of code state, providing zero validation of the authentication mechanism or file access controls.

**Impact:** Regressions in auth or file access go undetected. Deployment confidence is false.  
**Fix Required:** Implement actual test cases covering: valid/invalid tokens, path traversal attempts, authorized vs. unauthorized access, boundary conditions.

---

### 4. **No Input Validation at Trust Boundary** [DESIGN-MEDIUM]
**Location:** `src/server.js:11`  
**Issue:** The `name` query parameter is extracted and passed directly to `requestedFile()` with no validation:
```javascript
new URL(req.url, 'http://local').searchParams.get('name')
```
No checks for null, whitespace, special characters, or length. Combined with the path traversal vulnerability (Finding 1), this creates multiple attack vectors.

**Impact:** Enables both path traversal and potential DoS (extremely long filenames, null bytes if filesystem allows).  
**Fix Required:** Validate the `name` parameter before use: reject null/empty/non-string values, reject paths with `/`, `\`, or `..`, validate length limits.

---

### 5. **Unconditional Destructive Migration Without Guards** [OPERATIONS-MEDIUM]
**Location:** `migrations/003_remove_audit.sql`  
**Issue:** The migration unconditionally drops a table without conditional logic:
```sql
DROP TABLE audit_events;
```
The README states "migrations preserve customer records," yet audit events are destroyed with no `IF EXISTS` clause, no backup trigger, and no idempotency guarantee. A retry or rerun of migrations fails; a deployment to an environment where the table doesn't yet exist (new database, different schema) will error.

**Impact:** Database deployment can fail or lose audit data silently depending on state.  
**Fix Required:** Use `DROP TABLE IF EXISTS audit_events;` for idempotency. Consider whether audit data retention is required for compliance; if so, archive before dropping or use soft deletes.

---

## Summary of Verification

Reviewed all source code (`src/server.js`, `src/files.js`), test suite (`tests/smoke.js`), migrations (`migrations/003_remove_audit.sql`), and package configuration. Analyzed against the engineering policy baseline covering input validation at trust boundaries, weak defaults, test coverage, and operational safety. No code changes made.
