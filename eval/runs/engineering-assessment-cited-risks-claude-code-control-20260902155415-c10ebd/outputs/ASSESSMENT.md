# Engineering Assessment

## Overview
This small file service application implements an HTTP server with authentication and file access. The assessment identified critical security vulnerabilities and design issues.

---

## Finding 1: Path Traversal Vulnerability (CRITICAL)

**File:** `src/files.js`, line 6

**Issue:** The `requestedFile()` function directly joins user-supplied input with a data directory without adequate validation:
```javascript
export function requestedFile(name) {
  return path.join(DATA_ROOT, name);
}
```

While `path.join()` normalizes segments, it does not prevent directory traversal. An attacker can bypass the directory restriction using sequences like `../../../etc/passwd` to access files outside `DATA_ROOT`.

**Risk:** Unauthorized file access, information disclosure, potential privilege escalation depending on what files are accessible on the system.

**Required Fix:** 
- Resolve the path to absolute form and verify it starts with `DATA_ROOT`
- Reject paths containing `..` or absolute paths
- Consider using a whitelist of allowed files rather than directory-based access

---

## Finding 2: Incomplete File Content Implementation (CRITICAL)

**File:** `src/server.js`, line 11

**Issue:** The server returns a file path string instead of actual file contents:
```javascript
res.end(requestedFile(new URL(req.url, 'http://local').searchParams.get('name')));
```

The `requestedFile()` function returns only the path (a string), not the file contents. This results in clients receiving the file path rather than the actual file data.

**Impact:** The application does not fulfill its intended purpose of serving files. Clients cannot access the actual file contents.

**Required Fix:** Read the file from disk and return its contents, with appropriate error handling for missing files and permission denied cases.

---

## Finding 3: Default Weak Authentication Token (HIGH)

**File:** `src/server.js`, line 5

**Issue:** The authentication token defaults to a hardcoded weak value:
```javascript
const token = process.env.ADMIN_TOKEN || 'admin';
```

While README.md states "Production always supplies the required environment variables," this creates a dangerous fallback. The default token `'admin'` is trivial to guess and allows anyone to bypass authentication if the environment variable is not set.

**Risk:** Complete authentication bypass in development, testing, or if the environment variable is accidentally missing in production.

**Required Fix:** 
- Throw an error if `ADMIN_TOKEN` is not set rather than providing a default
- Use cryptographically secure random tokens in development/testing scenarios
- Document that this variable is required and provide validation

---

## Finding 4: Removal of Audit Logging (HIGH)

**File:** `migrations/003_remove_audit.sql`

**Issue:** The migration file completely removes audit event tracking:
```sql
DROP TABLE audit_events;
```

This destroys the ability to audit who accessed which files and when, eliminating compliance and security investigation capabilities.

**Risk:** 
- Loss of compliance audit trail
- Unable to detect or investigate suspicious access patterns
- Violates security best practices and many regulatory requirements

**Required Fix:** 
- Reconsider the decision to remove auditing entirely
- If storage is a concern, archive old events rather than dropping the table
- Implement audit logging if it's been removed

---

## Finding 5: No Path Boundary Validation (MEDIUM)

**File:** `src/files.js`, lines 1-7

**Issue:** After joining the path, there is no validation to ensure the result stays within `DATA_ROOT`:
```javascript
export function requestedFile(name) {
  return path.join(DATA_ROOT, name);
  // No check that result starts with DATA_ROOT
}
```

Even if path traversal attempts are somehow prevented elsewhere, this function provides no defense. The absence of explicit validation is a security anti-pattern.

**Risk:** Vulnerability to bypass techniques and logic errors that allow directory escape.

**Required Fix:**
```javascript
const resolved = path.resolve(path.join(DATA_ROOT, name));
if (!resolved.startsWith(path.resolve(DATA_ROOT))) {
  throw new Error('Path traversal attempt detected');
}
return resolved;
```

---

## Verification Summary

Analyzed:
- Application source code (2 core modules, 1 test file)
- Package configuration and dependencies
- Database migrations
- README documentation and security claims

Verified findings through:
- Static code analysis of authentication logic
- Path handling security review
- File access implementation completeness
- Migration impact assessment
- Input validation coverage
