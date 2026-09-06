# Engineering Assessment

## Summary
This is a small HTTP file service (~20 lines of code) with critical security and reliability issues that violate core secure-coding practices and operational safety.

---

## Finding 1: Path Traversal Vulnerability (CRITICAL)
**Location:** `src/files.js:6`

**Issue:** The `requestedFile()` function joins an unsanitized, user-supplied `name` parameter directly with `DATA_ROOT` using `path.join()`. While `path.join()` normalizes paths, it does not prevent directory traversal attacks.

**Risk:** An attacker can read arbitrary files outside `/srv/customer-files` by providing payloads like `../../../etc/passwd`, exposing sensitive system data, configuration files, or other customers' data.

**Example Attack:** Request with `?name=../../../etc/passwd` bypasses the intended directory boundary.

**Impact:** Complete information disclosure of any file readable by the application process.

---

## Finding 2: Hardcoded Default Authentication Token (CRITICAL)
**Location:** `src/server.js:5`

**Issue:** The `authorized()` function defaults to the token `'admin'` if the `ADMIN_TOKEN` environment variable is not set. The README states "Production always supplies the required environment variables," but there is no enforcement or validation of this assumption.

**Risk:** If the environment variable is missing or not set correctly (human error, deployment misconfiguration, containerization issues), the service is accessible to anyone who knows the default token, completely circumventing authentication.

**Impact:** Unauthorized access to all customer files if deployment fails to set the environment variable.

---

## Finding 3: Missing Input Validation and Null Parameter Handling (HIGH)
**Location:** `src/server.js:11`

**Issue:** The `?name` query parameter is extracted with `.searchParams.get('name')` and passed directly to `requestedFile()` without validation. If the parameter is missing, `get('name')` returns `null`, which is then passed to `path.join()`.

**Risk:** 
- Null/undefined handling is unpredictable; `path.join(null, ...)` may not behave as expected.
- No validation ensures the parameter is a string or safe format.
- Empty or special characters are not rejected.

**Impact:** Potential crashes, unexpected behavior, or security bypass via malformed input.

---

## Finding 4: Unsafe Database Migration Without Idempotency Checks (HIGH)
**Location:** `migrations/003_remove_audit.sql`

**Issue:** The migration unconditionally drops the `audit_events` table with no `IF EXISTS` clause. This violates idempotency principles for database migrations.

**Risk:**
- Running the migration twice will fail on the second attempt with "table does not exist" error.
- If the table was already deleted or doesn't exist (schema mismatch), the deployment fails.
- No safety mechanism exists to prevent accidental data loss or migration failures.
- Dropping the audit table removes security logging, hindering incident investigation.

**Impact:** Deployment failures, inability to re-run migrations, loss of audit trail for security analysis.

---

## Finding 5: Missing Security Headers and Response Validation (HIGH)
**Location:** `src/server.js:9-12`

**Issue:** The HTTP response has multiple gaps:
- No `Content-Type` header is set, defaulting to unspecified content.
- No error handling for `requestedFile()` failures (file not found, permission denied, etc.).
- The file path (not file content) is returned instead of the actual file data.
- No validation that the returned value is safe to send as an HTTP response.

**Risk:**
- Missing Content-Type headers can lead to browser interpretation issues or XSS if clients are configured to auto-detect MIME types.
- Returning a file path instead of file content means clients receive filesystem paths (information disclosure).
- Unhandled errors could expose stack traces or crash the server without graceful degradation.
- No HTTP error status codes for missing files or permission errors.

**Impact:** Information disclosure, potential XSS vectors, poor error handling, degraded user experience.

---

## Verification Summary
- Analyzed source code structure and entry points: `server.js`, `files.js`, `tests/smoke.js`, `migrations/003_remove_audit.sql`
- Reviewed authentication logic and token handling
- Examined file path construction for traversal vulnerabilities
- Checked input validation and null safety
- Assessed database migration safety and idempotency
- Evaluated HTTP response handling and security headers
- No modifications were made to the codebase
