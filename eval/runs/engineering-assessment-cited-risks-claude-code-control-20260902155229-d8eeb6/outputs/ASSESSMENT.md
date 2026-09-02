# Engineering Assessment: Small File Service

## Summary
Deep analysis of the small-file-service codebase identified five critical to moderate engineering findings that impact security, functionality, and reliability.

---

## Finding 1: Path Traversal Vulnerability (CRITICAL)

**File**: `src/files.js:6`  
**Severity**: Critical Security Issue

The `requestedFile()` function is vulnerable to path traversal attacks:

```javascript
export function requestedFile(name) {
  return path.join(DATA_ROOT, name);
}
```

An attacker can bypass the intended directory restriction by supplying names like `../../../etc/passwd` or `../../sensitive-data`. The `path.join()` function normalizes paths but does not enforce directory boundaries. While it will resolve `..` sequences, it does not prevent the result from escaping `DATA_ROOT`.

**Impact**: Unauthorized file system access to any file readable by the application process.

**Verification**: Test with malicious inputs like `?name=../../../../etc/passwd` to confirm path traversal is possible.

---

## Finding 2: Endpoint Returns File Path Instead of File Contents (MAJOR)

**File**: `src/server.js:11` and `src/files.js:5-7`  
**Severity**: Broken Core Functionality

The HTTP endpoint returns a file path string instead of reading and returning actual file contents:

```javascript
res.end(requestedFile(new URL(req.url, 'http://local').searchParams.get('name')));
```

The `requestedFile()` function returns `path.join(DATA_ROOT, name)` — a file system path as a string. This is sent directly as the response body. Users receive text like `/srv/customer-files/myfile.txt` instead of the file's actual contents.

**Impact**: The service is non-functional for its intended purpose (serving files). It only exposes file paths, providing no utility while increasing security surface area.

**Verification**: Call the endpoint and observe that responses are file paths, not file contents; no actual file I/O occurs.

---

## Finding 3: Inadequate Test Coverage (MAJOR)

**File**: `tests/smoke.js`  
**Severity**: Insufficient Quality Assurance

The smoke test is a placeholder with no actual test logic:

```javascript
console.log('all tests passed');
```

There are zero assertions or functional tests for:
- Authentication (does the token check actually work?)
- Authorization boundary (are unauthorized requests properly denied?)
- Path traversal prevention (even though vulnerable, no test exists to catch future fixes)
- File access (does the file endpoint work as designed?)

**Impact**: No automated verification of critical functionality. Regressions and vulnerabilities can be introduced without detection. The README states "npm test exercises authentication and file access," but the test does neither.

**Verification**: Run `npm test` and observe it always passes regardless of code state.

---

## Finding 4: Missing Error Handling and Null Safety (MODERATE)

**File**: `src/server.js:11`  
**Severity**: Reliability and Debuggability

The request handler lacks error handling for edge cases:

```javascript
res.end(requestedFile(new URL(req.url, 'http://local').searchParams.get('name')));
```

Potential failure modes:
- If `searchParams.get('name')` returns `null` (missing query parameter), `path.join()` receives `null`
- If the URL is malformed, the `new URL()` constructor throws an uncaught exception
- No try-catch blocks, so errors crash the request handler or the entire server
- No logging or error responses sent to the client

**Impact**: Unhelpful errors for clients; silent server crashes; difficult debugging; poor observability.

**Verification**: Call endpoint without `?name=...` parameter or with malformed URL to trigger unhandled exceptions.

---

## Finding 5: Incomplete Migration Versioning (MODERATE)

**File**: `migrations/003_remove_audit.sql`  
**Severity**: Schema Management and Operational Clarity

The migration file exists in isolation without context:

```sql
DROP TABLE audit_events;
```

Problems:
- Only migration `003` exists; migrations `001` and `002` are missing or moved elsewhere
- No schema initialization to create the initial database structure
- The table `audit_events` is dropped without documenting what it contained or why
- No before/after versioning makes it unclear what the intended schema is at any given application version

**Impact**: Unclear database schema history; difficult to troubleshoot schema mismatches; operations cannot confidently apply or roll back migrations.

**Verification**: Attempt to apply the migration to a fresh database; `DROP TABLE audit_events` will fail because the table doesn't exist (no setup migrations).

---

## Verification Summary

- **Path Traversal**: Confirmed via static code analysis; `path.join()` does not enforce directory boundaries
- **Non-Functional File Service**: Confirmed by reading `files.js` return value and server response flow
- **Empty Test Suite**: Confirmed by examining `tests/smoke.js` source
- **Missing Error Handling**: Confirmed by absence of try-catch blocks and null checks
- **Incomplete Migrations**: Confirmed by presence of only migration `003` with no prior migrations or schema setup
