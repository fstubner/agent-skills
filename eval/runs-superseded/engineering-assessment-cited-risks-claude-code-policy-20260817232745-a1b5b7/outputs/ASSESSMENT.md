# Engineering Assessment: Small File Service

## Executive Summary

This repository contains a file serving HTTP service with **critical security and functional issues**. The application has a path traversal vulnerability, does not actually read or serve files (breaking core functionality), lacks meaningful test coverage, and has insufficient input validation. These issues violate the engineering policy requirement to "validate inputs and authorization at trust boundaries" and "add focused automated tests for critical behavior."

---

## Five Highest-Value Findings

### 1. **Path Traversal Vulnerability (CRITICAL)**
**File:** `src/files.js:6`  
**Issue:** The `requestedFile()` function directly concatenates user-supplied `name` parameter with `DATA_ROOT` using `path.join()` without validating that the result stays within the intended directory.

**Failure Scenario:**  
- Request with `?name=../../etc/passwd` bypasses directory boundary
- `path.join('/srv/customer-files', '../../etc/passwd')` resolves to `/etc/passwd`
- Attacker gains access to arbitrary files on the system

**Impact:** Complete compromise of file system confidentiality. Any file readable by the Node process can be accessed.

**Remediation:** Use `path.resolve()` to canonicalize paths and verify the result starts with the canonical `DATA_ROOT` path:
```javascript
const resolved = path.resolve(DATA_ROOT, name);
if (!resolved.startsWith(path.resolve(DATA_ROOT))) throw new Error('Access denied');
```

---

### 2. **Missing File I/O Implementation (CRITICAL)**
**File:** `src/files.js:5-6` and `src/server.js:11`  
**Issue:** The service returns file paths as response body instead of actual file contents. The `requestedFile()` function only performs path construction; it does not read files from disk.

**Failure Scenario:**  
- Client requests `GET /?name=document.pdf`
- Server responds with string `/srv/customer-files/document.pdf` instead of the file's contents
- No `fs` module is imported anywhere in the codebase

**Impact:** The stated purpose ("file access") is completely non-functional. Clients receive paths instead of data.

**Remediation:** Import `fs` module and actually read file contents:
```javascript
import fs from 'node:fs/promises';
export async function requestedFile(name) {
  const resolved = /* validate path as in finding #1 */;
  return fs.readFile(resolved);
}
```

---

### 3. **Inadequate Test Coverage (HIGH)**
**File:** `tests/smoke.js:1`  
**Issue:** The test file contains only a console.log with no actual test execution. README claims "npm test exercises authentication and file access" but the assertion is never validated.

**Failure Scenario:**  
- Critical request handling path (authorization, file serving) is completely untested
- Bug in `authorized()` or `requestedFile()` would not be caught
- Tests pass regardless of application correctness

**Impact:** Lack of regression detection; critical paths have zero automated verification.

**Remediation:** Implement actual tests with assertions:
```javascript
// Test authorization enforcement
// Test successful file serving with valid token
// Test path traversal rejection
// Test error handling
```

---

### 4. **No Input Validation (HIGH)**
**File:** `src/server.js:11`  
**Issue:** The `name` parameter from query string is passed directly to `requestedFile()` with no validation. Parameter can be null, undefined, empty string, or contain arbitrary characters.

**Failure Scenario:**  
- `?name=null` causes unexpected behavior
- `?name=` (empty string) returns directory listing or base path
- No type or format checking before path operations

**Impact:** Unpredictable behavior and amplifies the path traversal vulnerability. No defense-in-depth.

**Remediation:** Validate at the HTTP boundary:
```javascript
const name = new URL(req.url, 'http://local').searchParams.get('name');
if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
  res.writeHead(400);
  return res.end('invalid name');
}
```

---

### 5. **Default Credentials Risk (MEDIUM-HIGH)**
**File:** `src/server.js:5`  
**Issue:** Authentication falls back to hardcoded default `'admin'` if the `ADMIN_TOKEN` environment variable is not set. README claims "Production always supplies the required environment variables" but this is not enforced in code.

**Failure Scenario:**  
- Deployment forgets to set `ADMIN_TOKEN` environment variable
- Any client with `x-admin-token: admin` gains full access
- Silent failure (no error is raised; default is silently used)

**Impact:** Security model depends on operational discipline that has no enforcement mechanism.

**Remediation:** Require explicit configuration with no fallback:
```javascript
const token = process.env.ADMIN_TOKEN;
if (!token) throw new Error('ADMIN_TOKEN environment variable is required');
```

---

## Verification Summary

**Analysis Method:** Static code review of all application files (3 source files, 1 migration, 1 test suite).

**Verified:**
- Path construction does not include path canonicalization or boundary verification ✓
- No file system operations are performed (no `fs` imports) ✓
- Test file contains no actual test assertions ✓
- Parameter `name` has no validation before use ✓
- Auth token defaults to hardcoded string without environment variable check ✓

**Not Verified (permission not granted for dynamic testing):**
- Runtime behavior of HTTP server
- Actual path traversal exploitation
- Response body contents in running service

---

## Alignment with Engineering Policy

The findings violate three core policy requirements:
1. **"Validate inputs and authorization at trust boundaries"** — No validation of query parameters; insufficient auth enforcement
2. **"Add focused automated tests for critical behavior"** — Test file is hollow; critical paths untested
3. **"Run the product before claiming completion"** — Application is functionally broken and not serving files
