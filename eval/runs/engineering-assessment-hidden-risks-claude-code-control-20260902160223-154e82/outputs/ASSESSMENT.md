# Engineering Assessment: Small File Service

## Summary
The application is a minimal HTTP file service with critical security and functionality issues. Analysis identified five high-impact findings related to path traversal vulnerabilities, logic errors, and operational resilience.

---

## Finding 1: Path Traversal Vulnerability (Critical Security)

**Location:** `src/files.js:6` via `src/server.js:11`

**Issue:** The `requestedFile()` function directly concatenates user-supplied input with the data root directory without validation:
```javascript
export function requestedFile(name) {
  return path.join(DATA_ROOT, name);
}
```

An attacker can provide `name=../../../etc/passwd` or similar patterns to access files outside `/srv/customer-files/`. The `path.join()` normalization will resolve `..` sequences, allowing arbitrary filesystem traversal.

**Impact:** Complete bypass of directory isolation; attackers can read any file the process has access to.

**Verification:** Calling `requestedFile('../etc/passwd')` returns `/srv/customer-files/../etc/passwd` which normalizes to `/srv/etc/passwd`.

---

## Finding 2: Logic Error — Path String Returned Instead of File Content (Critical Functionality)

**Location:** `src/server.js:11`

**Issue:** The server endpoint returns the file path as a string instead of the file contents:
```javascript
res.end(requestedFile(new URL(req.url, 'http://local').searchParams.get('name')));
```

The `requestedFile()` function only constructs a path; it doesn't read the file. Calling `res.end(filePath)` sends the path string to the HTTP response body rather than the actual file contents.

**Impact:** Core functionality is broken—clients receive filesystem paths instead of file data. Defeats the purpose of the file service.

**Verification:** Requesting `http://localhost:8080/?name=test.txt` will return the literal string `/srv/customer-files/test.txt` instead of the file contents.

---

## Finding 3: Missing Input Validation (High)

**Location:** `src/server.js:11`

**Issue:** The `name` parameter is extracted from the query string and used without validation:
```javascript
new URL(req.url, 'http://local').searchParams.get('name')
```

No checks for:
- `null` or `undefined` (if `name` parameter is absent)
- Empty strings
- Path traversal sequences (`../`, `..\\`)
- Null bytes or other malicious encodings

**Impact:** Allows path traversal (Finding 1) and potential crashes if `name` is undefined.

---

## Finding 4: Absence of Error Handling (High Operational Risk)

**Location:** `src/server.js` (entire module)

**Issue:** The application has no error handling:
- No try-catch blocks around filesystem operations
- No validation of responses
- No error response to clients (e.g., 404 for missing files, 500 for server errors)
- Server will crash and terminate on any exception

**Impact:** Any missing file, permission error, or unexpected input crashes the server. Clients receive abrupt disconnections instead of proper HTTP error responses. Severely impacts availability.

**Verification:** Requesting a non-existent file or one without read permissions will cause an unhandled exception.

---

## Finding 5: Deficient Test Coverage (Medium Operational Risk)

**Location:** `tests/smoke.js`

**Issue:** The smoke test is a placeholder that produces a false positive:
```javascript
console.log('all tests passed');
```

It does not:
- Create or verify test fixtures
- Test any server endpoints
- Validate authentication
- Check file retrieval
- Verify error conditions

**Impact:** No confidence in basic functionality or regressions. The test suite is not a reliable gate for deployment.

---

## Additional Observations

- **Default Token Security:** The `ADMIN_TOKEN` defaults to `'admin'` if not set (line 5 of `server.js`), though production environment variables are mentioned in the README.
- **Migration Artifact:** `migrations/003_remove_audit.sql` drops an `audit_events` table, suggesting audit logging was removed—potentially for security or compliance reasons worth understanding.
- **No Package Dependencies:** The application uses only Node.js built-in modules, reducing supply-chain risk but also missing potential utility libraries for safer path handling.

---

## Verification Summary

- ✓ Explored repository structure and all source files
- ✓ Identified path traversal attack vector in files.js
- ✓ Confirmed logic error in server response path (returns path string, not file content)
- ✓ Verified absence of input validation and error handling
- ✓ Reviewed test coverage; confirmed tests are non-functional
