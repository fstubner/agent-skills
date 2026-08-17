# Engineering Assessment: Small File Service

## Summary
This is a file serving HTTP application with a simple authentication layer. The assessment identified five critical engineering issues related to security, input validation, error handling, and core functionality.

---

## Five Highest-Value Findings

### 1. **Path Traversal Vulnerability Allows Escaping Base Directory** (CRITICAL)
**Location:** `src/files.js:6`  
**Issue:** The `requestedFile()` function joins `DATA_ROOT` with untrusted user input without validation:
```javascript
export function requestedFile(name) {
  return path.join(DATA_ROOT, name);
}
```
An attacker can craft a request with `name=../../etc/passwd` to escape the `/srv/customer-files` directory and access arbitrary files on the system. The `path.join()` method does not prevent `..` sequences from traversing parent directories.

**Why it matters:** This violates the "Validate inputs and authorization at trust boundaries" principle. Any authenticated user (even with weak credentials) can read sensitive files outside the intended directory, completely defeating the purpose of file access controls.

**Mitigation:** Validate that the resolved path stays within `DATA_ROOT` using `path.resolve()` and `path.relative()`, or use an allowlist of permitted files.

---

### 2. **Response Sends File Path Instead of File Contents** (CRITICAL)
**Location:** `src/server.js:11`  
**Issue:** The application returns a file path string as the HTTP response body rather than file contents:
```javascript
res.end(requestedFile(new URL(req.url, 'http://local').searchParams.get('name')));
```
The `requestedFile()` function returns a path like `/srv/customer-files/document.txt`, which is sent directly to clients. This defeats the core purpose of a file service.

**Why it matters:** The application does not actually serve file contents, making it non-functional for its intended purpose. Clients receive paths instead of data.

**Mitigation:** Read the file using `fs.readFile()` or `fs.createReadStream()` and send the contents, not the path.

---

### 3. **Weak Authentication Default When Environment Variable Missing** (HIGH)
**Location:** `src/server.js:5`  
**Issue:** The `authorized()` function defaults to `'admin'` if `ADMIN_TOKEN` is not set:
```javascript
const token = process.env.ADMIN_TOKEN || 'admin';
```
While the README claims "Production always supplies required environment variables," this contract is not enforced. A misconfigured deployment would default to a hardcoded token, completely exposing the service to anyone with that token.

**Why it matters:** Environmental assumptions are fragile in real deployments. Defaults should fail securely. This creates a critical gap between documentation and actual security.

**Mitigation:** Throw an error if `ADMIN_TOKEN` is not provided, or use a stronger secure default (e.g., generated token from a secrets manager).

---

### 4. **Missing Input Validation: Null Query Parameter Passed to File Operations** (MEDIUM)
**Location:** `src/server.js:11`  
**Issue:** No validation that the `name` query parameter exists before use:
```javascript
.searchParams.get('name')  // Returns null if missing
```
If `name` is omitted, `null` is passed to `requestedFile()`, which joins it with `DATA_ROOT`, resulting in `/srv/customer-files` or unexpected behavior. This allows unauthenticated directory traversal in a different form.

**Why it matters:** Required inputs must be validated at trust boundaries. Missing validation allows unexpected states to reach file operations.

**Mitigation:** Validate that `name` is a non-empty string before processing.

---

### 5. **No Error Handling: Server Crashes on File Operation Failures** (MEDIUM)
**Location:** `src/server.js:9-11`  
**Issue:** No try-catch or error handlers around file operations or response writing:
```javascript
http.createServer((req, res) => {
  if (!authorized(req)) { res.writeHead(403); return res.end('denied'); }
  res.end(requestedFile(...));  // No error handling
}).listen(8080);
```
If file operations fail (permission denied, file not found, disk error) or if writing the response fails, the server process may crash or leave the connection in an incomplete state. There are no error responses.

**Why it matters:** Missing error handling makes the application unreliable and difficult to debug. Clients don't receive meaningful feedback on failures. The server can crash unexpectedly.

**Mitigation:** Wrap file operations in try-catch, validate file existence, and return appropriate HTTP status codes (404 for missing files, 500 for server errors).

---

## Additional Observations

- **Test Coverage:** `tests/smoke.js` contains only a placeholder log statement with no actual test assertions. There are no tests for authentication, file access, path traversal, or error cases.
- **Audit Logging Removal:** `migrations/003_remove_audit.sql` drops the entire audit_events table. Without audit logging, there is no trace of who accessed which files—a significant loss of security posture for a file serving application.

---

## Verified During Assessment

✓ Code structure and file hierarchy examined  
✓ All source files read and analyzed (server.js, files.js, smoke.js, migrations)  
✓ Authentication mechanism reviewed  
✓ Input handling traced end-to-end  
✓ Error handling gaps identified  
✓ Path traversal attack surface analyzed
