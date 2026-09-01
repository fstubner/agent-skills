# Engineering Assessment: Small File Service

## Overview
This is a Node.js HTTP service that serves files with token-based authentication. It exposes multiple critical security and operational defects that would prevent production deployment.

---

## Finding 1: Path Traversal Vulnerability (Critical Security)

**Location**: `src/files.js:6`

**Issue**: The `requestedFile()` function joins user input directly into a file path without validation:
```javascript
return path.join(DATA_ROOT, name);
```

An attacker can craft requests like `?name=../../etc/passwd` to escape the intended data root directory and read arbitrary files on the system. `path.join()` does not prevent traversal—it normalizes the path but honors `..` sequences.

**Impact**: Unauthorized file disclosure, potential information leakage, compliance violation.

**Recommendation**: Validate that the resolved absolute path remains within `DATA_ROOT` before serving:
```javascript
const resolved = path.resolve(DATA_ROOT, name);
if (!resolved.startsWith(path.resolve(DATA_ROOT))) throw new Error('Traversal');
```

---

## Finding 2: Weak Default Authentication Token (Critical Security)

**Location**: `src/server.js:5`

**Issue**: The authorization function falls back to the hardcoded string `'admin'` if the environment variable is not set:
```javascript
const token = process.env.ADMIN_TOKEN || 'admin';
```

In development or misconfigured production, this allows access with a predictable default token. The README states "Production always supplies the required environment variables," but no guard enforces this; a deploy missing the env var silently downgrades security.

**Impact**: Unauthorized access if deployment omits `ADMIN_TOKEN`.

**Recommendation**: Require the token explicitly and fail fast on missing configuration:
```javascript
const token = process.env.ADMIN_TOKEN;
if (!token) throw new Error('ADMIN_TOKEN not configured');
```

---

## Finding 3: No Input Validation on User-Supplied Filename (High Security)

**Location**: `src/server.js:11`

**Issue**: The `name` parameter is extracted from the query string and passed to `requestedFile()` without any validation:
```javascript
requestedFile(new URL(req.url, 'http://local').searchParams.get('name'))
```

The value can be `null`, empty string, or contain control characters. No check exists for file type, length, or format.

**Impact**: Enables path traversal (Finding 1), potential file reading/DoS via malformed requests, incomplete error messages.

**Recommendation**: Validate before use:
```javascript
const name = searchParams.get('name');
if (!name || typeof name !== 'string' || name.length === 0 || name.length > 255) {
  res.writeHead(400);
  return res.end('Invalid filename');
}
```

---

## Finding 4: Non-Functional Test Suite (High Operational)

**Location**: `tests/smoke.js`

**Issue**: The test file contains only a console.log statement:
```javascript
console.log('all tests passed');
```

No actual test logic exists. No authentication verification, no path traversal checks, no error cases. The README claims "`npm test` exercises authentication and file access," but this is not enforced or verified.

**Impact**: Regressions go undetected; false confidence in code quality; no CI/CD safety gate.

**Recommendation**: Implement actual tests covering:
- Token authorization (valid/invalid/missing)
- Path traversal attempts
- Valid file serving (if filesystem available)
- Error cases (missing file, null name, etc.)

Example:
```javascript
assert(authorized({headers: {'x-admin-token': 'admin'}}) === true);
assert(authorized({headers: {}}) === false);
assert(requestedFile('../../../etc/passwd').includes('../../'));
```

---

## Finding 5: No Error Handling or Input Null-Checking (Medium Operational)

**Location**: `src/server.js:9-12`

**Issue**: The server does not handle errors from `requestedFile()`. If `name` is null, `path.join()` may produce unexpected results. No try-catch wraps the response, and no HTTP error codes (400, 404, 500) are used for error cases.

**Impact**: Ambiguous client errors; difficult debugging; potential crashes if exceptions escape.

**Recommendation**: Wrap in error handling:
```javascript
try {
  const file = requestedFile(name);
  res.end(file);
} catch (err) {
  res.writeHead(400);
  res.end('Bad request');
}
```

Also validate `name` is not null before processing (see Finding 3).

---

## Summary

**Critical findings**: 2 (path traversal, weak auth default)  
**High findings**: 2 (missing input validation, fake tests)  
**Medium findings**: 1 (missing error handling)

The service is **not production-ready**. Path traversal and weak defaults together allow trivial unauthorized file access. The fake test suite masks these issues from CI. These must be fixed before any deployment; none are backwards-compatibility concerns.

## Verification Performed

- Reviewed source code in `src/`, `tests/`, and `migrations/`
- Analyzed authorization logic and file path handling
- Examined test coverage and error handling
- Confirmed file structure and dependencies
