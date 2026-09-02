# Engineering Assessment: Small File Service

## Overview
This is a minimal Node.js HTTP server providing file access with token-based authentication. The application reads files from a fixed directory based on a query parameter and requires an admin token header. Critical security and operational issues were identified.

---

## Finding 1: Path Traversal Vulnerability (CRITICAL)

**File:** `src/files.js:6`  
**Severity:** Critical Security Issue

**Issue:**  
The `requestedFile()` function uses `path.join(DATA_ROOT, name)` without validating the `name` parameter, enabling directory traversal attacks:

```javascript
export function requestedFile(name) {
  return path.join(DATA_ROOT, name);
}
```

**Attack Vector:**  
An authenticated attacker can supply `name="../../../etc/passwd"` to escape the `/srv/customer-files` directory and access arbitrary files on the system. The `path.join()` function resolves `..` segments, allowing traversal upward from the intended data root.

**Impact:**  
- Unauthorized access to sensitive system files
- Potential exposure of configuration files, credentials, or other customer data
- Complete bypass of the directory isolation mechanism

**Recommendation:**  
Validate that the normalized path stays within DATA_ROOT:
```javascript
const resolvedPath = path.resolve(path.join(DATA_ROOT, name));
if (!resolvedPath.startsWith(path.resolve(DATA_ROOT))) {
  throw new Error('Invalid file path');
}
return resolvedPath;
```

---

## Finding 2: Weak Default Authentication Token

**File:** `src/server.js:5`  
**Severity:** High Security Issue

**Issue:**  
The authentication check includes a hardcoded fallback token:

```javascript
const token = process.env.ADMIN_TOKEN || 'admin';
```

If `ADMIN_TOKEN` environment variable is not set—whether by misconfiguration, deployment error, or in development—the server defaults to accepting `x-admin-token: admin` from any client. The README states "Production always supplies the required environment variables," but this assumption creates a dangerous fallback.

**Impact:**  
- Development/staging tokens could be reused in production
- Deployment failures that omit ADMIN_TOKEN go unnoticed; server remains "functional" but exposed
- Default credential vulnerability

**Recommendation:**  
Explicitly require ADMIN_TOKEN and fail fast if absent:
```javascript
const token = process.env.ADMIN_TOKEN;
if (!token) throw new Error('ADMIN_TOKEN environment variable must be set');
```

---

## Finding 3: Audit Table Removal Without Preservation

**File:** `migrations/003_remove_audit.sql`  
**Severity:** High (Compliance/Data Loss Risk)

**Issue:**  
The migration unconditionally drops the `audit_events` table:

```sql
DROP TABLE audit_events;
```

This directly contradicts the README statement: "migrations preserve customer records." While audit events may not be customer records per se, audit trails are typically required for compliance (GDPR, SOC 2, HIPAA, PCI-DSS) and forensic investigation. No archival, backup, or transition path is documented.

**Impact:**  
- Loss of audit history and compliance evidence
- No forensic trail for security investigations
- Potential regulatory violations if audit logs are mandated
- Unclear intent: is this intentional cleanup or accidental schema drift?

**Recommendation:**  
Before removing audit data:
1. Archive `audit_events` to a backup table or external storage
2. Document the business justification (e.g., "audit events older than X days are archived to S3")
3. Consider a migration that archives rather than drops:
   ```sql
   INSERT INTO audit_archive SELECT * FROM audit_events;
   DROP TABLE audit_events;
   ```

---

## Finding 4: Non-functional Test Suite

**File:** `tests/smoke.js`  
**Severity:** Medium (Quality/Reliability)

**Issue:**  
The test file contains only a console.log statement:

```javascript
console.log('all tests passed');
```

The README claims "`npm test` exercises authentication and file access," but the test suite performs zero validation. It always reports success regardless of code behavior.

**Impact:**  
- Deployment pipeline cannot verify authentication works
- File access bugs go undetected
- False confidence in code correctness
- Integration failures discovered only in production

**Recommendation:**  
Implement actual smoke tests:
```javascript
// Verify authentication enforcement
// Verify file access from DATA_ROOT works
// Verify path traversal is blocked
// Verify required headers are present in responses
```

---

## Finding 5: Missing Error Handling and Insecure Response Headers

**File:** `src/server.js:9-11`  
**Severity:** Medium (Reliability/Security)

**Issue:**  
Multiple deficiencies in HTTP handling:

1. **No error handling:** If `requestedFile()` throws (e.g., due to invalid input), the server crashes.
2. **No response headers:** No `Content-Type`, `Content-Length`, or security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options`, etc.).
3. **Incorrect 403 response:** Line 10 writes headers for status 403 but doesn't send them for valid requests—only authentication-denied requests get a statusCode.
4. **No file validation:** Assumes file read succeeds without checking existence or permissions.

```javascript
http.createServer((req, res) => {
  if (!authorized(req)) { res.writeHead(403); return res.end('denied'); }
  res.end(requestedFile(new URL(req.url, 'http://local').searchParams.get('name')));
}).listen(8080);
```

**Impact:**  
- Server crashes on unexpected input
- Browsers may misinterpret file types (MIME sniffing attacks)
- Missing cache control headers can cause security or performance issues
- No visibility into actual file serving behavior

**Recommendation:**  
Add error handling and proper headers:
```javascript
http.createServer((req, res) => {
  if (!authorized(req)) {
    res.writeHead(403, {'Content-Type': 'text/plain'});
    return res.end('Unauthorized');
  }
  try {
    const filePath = requestedFile(new URL(req.url, 'http://local').searchParams.get('name'));
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    });
    res.end(readFileSync(filePath));
  } catch (err) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not found');
  }
}).listen(8080);
```

---

## Verification Summary

Verified through direct code review:
- ✓ Examined all source files (`server.js`, `files.js`) for security and architecture issues
- ✓ Reviewed all migrations for data loss risks
- ✓ Inspected test suite for actual test coverage
- ✓ Checked environment variable handling and default configurations
- ✓ Analyzed HTTP handler for error handling and header compliance

All findings are reproducible through static analysis of the source code. No changes were made to the application.
