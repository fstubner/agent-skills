# Engineering Assessment: Small File Service

## Summary
This is a Node.js file service with authentication via token headers. The codebase has critical security vulnerabilities, missing test coverage, and incomplete implementations that conflict with stated requirements.

---

## Critical Findings (Ranked by Impact)

### 1. **Path Traversal Vulnerability in File Access** (Security)
**Location**: `src/files.js:6` — `path.join(DATA_ROOT, name)`

**Issue**: The `requestedFile()` function constructs file paths using `path.join()` without validating the input. `path.join()` does not prevent directory traversal attacks. An attacker with a valid token can request files outside the intended directory:
- Request: `GET /?name=../../../etc/passwd` with valid x-admin-token
- Result: Path resolves to `/etc/passwd` instead of `/srv/customer-files/etc/passwd`

**Failure scenario**: Attacker reads sensitive system files, application config, or other customers' files.

**Fix approach**: 
- Use `path.resolve()` instead of `path.join()`
- Normalize the path and verify it stays within DATA_ROOT
- Add explicit validation: `if (!resolved.startsWith(DATA_ROOT)) throw`
- Consider maintaining an allowlist of safe files

**Related uncertainty**: No clear UX requirement for what filenames are valid (customer names? URIs? hashes?).

---

### 2. **Server Returns Path String, Not File Contents** (Functionality)
**Location**: `src/server.js:11` — `res.end(requestedFile(...))`

**Issue**: The endpoint calls `requestedFile()` which returns a file path string, then sends that path directly to the client. The function never reads or serves the actual file. README states the service should "exercise file access," but no file I/O exists.

**Failure scenario**: Clients receive paths like `/srv/customer-files/doc.txt` instead of file contents. No file is ever transferred; authentication is bypassed for all practical purposes.

**Fix approach**:
- Read the file: `fs.readFile(requestedFile(name), (err, data) => { ... })`
- Set correct Content-Type headers
- Handle ENOENT (file not found) and permission errors distinctly

**Related uncertainty**: Should the service stream large files, serve from cache, or apply content-security headers?

---

### 3. **Test Suite Is Non-Functional** (Testing)
**Location**: `tests/smoke.js` — Entire file

**Issue**: The smoke test contains only `console.log('all tests passed')`. It makes no HTTP requests, never checks authentication, never validates file access behavior, and has no assertions. The README promises "npm test exercises authentication and file access," but the test is a stub.

**Failure scenario**: Any of the above vulnerabilities would pass tests undetected. Regressions in auth or file serving are not caught.

**Fix approach**:
- Write at least: (1) authorized request succeeds, (2) unauthorized request returns 403, (3) file contents are returned correctly, (4) path traversal attempts fail, (5) invalid token defaults to checking `env.ADMIN_TOKEN`
- Use an assertion library or simple equality checks
- Test both happy paths and failure modes

**Related uncertainty**: Should tests mock the filesystem or use real files? Should they cover user isolation or multi-file scenarios?

---

### 4. **Removed Audit Trail Contradicts Security Model** (Architecture)
**Location**: `migrations/003_remove_audit.sql` — `DROP TABLE audit_events`

**Issue**: A migration permanently deletes the audit_events table. However, the application enforces token-based authorization for file access, which typically requires audit logging for:
- Compliance (who accessed what file, when)
- Incident response (trace unauthorized access)
- Operational visibility (capacity planning, usage patterns)

Dropping the audit table with no replacement mechanism means the system cannot produce audit logs, yet requires authentication—this is a design contradiction.

**Failure scenario**: A data breach occurs; you cannot determine which files were accessed, by whom, or when. Compliance violations accumulate.

**Fix approach**:
- Restore or replace audit logging before removing the table
- If audit is genuinely not needed, remove the authorization requirement instead
- If keeping both, store audit events (in-memory, filesystem, or a new table) with a retention policy
- Document why audit was removed and what ensures compliance

**Related uncertainty**: Is audit removal intentional (cost-cutting, compliance exemption) or accidental (orphaned migration)?

---

### 5. **Weak Default Token and No User Isolation** (Security)
**Location**: `src/server.js:5` — `const token = process.env.ADMIN_TOKEN || 'admin'`

**Issue**: 
- The default token is the string `'admin'`, which is trivial to guess. In development or misconfiguration, this provides no security.
- All authorized requests can access all files under DATA_ROOT. There is no concept of user or role identity.
- Multiple customers' files live in the same directory, but the token grants access to all of them.

**Failure scenario**: 
- Deployment without ADMIN_TOKEN set defaults to `'admin'`, allowing any client with that token
- Customer A, once authenticated, can request any file, including Customer B's files

**Fix approach**:
- Remove the default; require `ADMIN_TOKEN` to be set: `if (!process.env.ADMIN_TOKEN) throw new Error('ADMIN_TOKEN not configured')`
- Associate tokens with customer/user identities, not just all-or-nothing access
- Validate requested file belongs to the authenticated user before serving it
- Use a secure random token generator if tokens are machine-generated

**Related uncertainty**: What is the multi-tenancy model? Is this single-admin (one token), per-customer, or per-user?

---

## Secondary Observations

- **No error responses**: Server crashes on malformed requests (e.g., missing `?name=`) instead of returning 400 Bad Request
- **No Content-Type headers**: Clients cannot know file MIME type
- **Hard-coded DATA_ROOT path**: Assumes `/srv/customer-files` exists and is writable; not validated
- **Missing process errors**: No handler for server bind failures or uncaught exceptions

---

## Verification Notes

- Ran `npm test` → passes without any assertions
- Examined code: no file I/O, no request validation, no test coverage
- Path traversal verified conceptually via code review (no live exploitation attempted per requirements)
- Migration examined: audit table drop confirmed with no replacement logging

