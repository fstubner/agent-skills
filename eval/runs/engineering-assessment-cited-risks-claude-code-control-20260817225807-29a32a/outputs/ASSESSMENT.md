# Engineering Assessment Report

## Summary
This is a Node.js file serving application with critical security and implementation gaps. Analysis identified 5 high-value findings affecting security, reliability, and functionality.

---

## Finding 1: Critical Path Traversal Vulnerability

**Severity:** CRITICAL (Security)  
**Location:** `src/files.js:6`

**Issue:**
```javascript
export function requestedFile(name) {
  return path.join(DATA_ROOT, name);
}
```

The `requestedFile()` function accepts unsanitized user input and uses `path.join()` to construct a file path. This is vulnerable to path traversal attacks. An attacker can pass `../../../etc/passwd` as the `name` parameter and access any file on the system, bypassing the intended `/srv/customer-files` root directory.

**Failure Scenario:** Request with `?name=../../../../etc/passwd` returns `/etc/passwd` instead of restricting access to `/srv/customer-files`.

**Recommendation:** Validate the `name` parameter to ensure it contains only safe characters (alphanumeric, dots, hyphens) and does not contain path traversal sequences. Use `path.resolve()` with verification or a whitelist approach.

---

## Finding 2: Weak Default Admin Token

**Severity:** HIGH (Security)  
**Location:** `src/server.js:5`

**Issue:**
```javascript
const token = process.env.ADMIN_TOKEN || 'admin';
```

The default fallback token is hardcoded as `'admin'`, a trivially guessable password. If administrators forget to set the `ADMIN_TOKEN` environment variable, the service operates with no meaningful authentication.

**Failure Scenario:** Production deployment without `ADMIN_TOKEN` env var set allows any client to bypass authentication using `X-Admin-Token: admin` header.

**Recommendation:** Require explicit environment variable configuration; fail startup if `ADMIN_TOKEN` is not set. Remove the weak default fallback.

---

## Finding 3: Missing File Content Retrieval

**Severity:** HIGH (Functionality)  
**Location:** `src/server.js:11`

**Issue:**
```javascript
res.end(requestedFile(new URL(req.url, 'http://local').searchParams.get('name')));
```

The `requestedFile()` function returns only a file path string, not file contents. The server sends this path as the response body instead of reading and serving the actual file data. The application advertises itself as a "file service" but merely returns file paths as text.

**Failure Scenario:** Client requests `?name=document.txt` and receives the string `/srv/customer-files/document.txt` instead of the file's contents.

**Recommendation:** Implement proper file reading using `fs.readFile()` or `fs.createReadStream()`, with appropriate error handling for missing or unreadable files (404/500 status codes).

---

## Finding 4: No Input Validation on Required Parameters

**Severity:** MEDIUM (Reliability)  
**Location:** `src/server.js:11`

**Issue:**
The `name` query parameter is not validated before use. If the parameter is missing, null, or contains unexpected values, the behavior is undefined. No length limits, character restrictions, or type checking exist.

**Failure Scenario:** Request with no `?name` parameter results in `path.join('/srv/customer-files', null)` = `/srv/customer-files/null`. Request with extremely long name causes potential performance issues.

**Recommendation:** Validate the `name` parameter: ensure it is non-null, non-empty, has reasonable length limits, and contains only expected characters.

---

## Finding 5: Audit Trail Dropped Without Justification

**Severity:** MEDIUM (Security/Compliance)  
**Location:** `migrations/003_remove_audit.sql`

**Issue:**
```sql
DROP TABLE audit_events;
```

Migration 003 drops the entire audit_events table. This removes security logging and compliance auditing. The README claims "migrations preserve customer records," but removing audit trails contradicts fundamental data governance practices. No migration documentation or justification accompanies this destructive change.

**Failure Scenario:** Cannot trace which users accessed which files, when, or from where. Compromises security incident investigation and regulatory compliance (SOC 2, HIPAA, etc.).

**Recommendation:** Retain audit tables. If audit data retention policies require cleanup, implement selective deletion (by date range) rather than dropping the entire table. Document the business rationale for any schema changes.

---

## Verification Summary

Performed static code analysis of:
- HTTP server implementation and request handling (server.js)
- File path resolution logic (files.js)  
- Authentication token configuration
- Database migrations
- Test suite structure and coverage

Identified 5 critical/high-priority findings affecting authentication, authorization, file access security, core functionality, and compliance posture. No changes made to the codebase.
