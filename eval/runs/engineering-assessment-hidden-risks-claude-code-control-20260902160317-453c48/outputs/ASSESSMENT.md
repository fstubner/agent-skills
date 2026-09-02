# Engineering Assessment

## Five Highest-Value Findings

### 1. Critical: Path Traversal Vulnerability in File Access (src/files.js)
**Severity:** Critical | **Type:** Security

The `requestedFile()` function uses `path.join(DATA_ROOT, name)` without validating that the `name` parameter doesn't contain path traversal sequences. Node.js `path.join()` resolves `..` components, allowing attackers to access arbitrary files on the system.

**Attack Example:** A request with `?name=../../../etc/passwd` would resolve to `/etc/passwd` instead of a file within `/srv/customer-files`.

**Impact:** Complete information disclosure—attackers can read any file accessible to the service process, including sensitive application files, configuration, and system data.

**Fix:** Validate that the resolved path stays within `DATA_ROOT` using `path.resolve()` and comparison, or reject `..` and absolute paths in input.

---

### 2. Critical: Missing Input Validation on File Name (src/server.js:11)
**Severity:** Critical | **Type:** Security

The `name` query parameter is passed directly from the URL to `requestedFile()` with no validation. No checks for:
- Null/undefined values
- Path traversal sequences (`..`, `/`)
- Absolute paths
- Maximum length or suspicious patterns

**Impact:** Combined with finding #1, enables path traversal attacks. Also creates denial-of-service risk if no bounds checking exists.

**Fix:** Implement whitelist validation—only alphanumeric filenames, underscores, and dots are typically safe. Reject anything containing `/`, `\`, or `..`.

---

### 3. High: No Runtime Verification of File Boundaries (src/files.js:6)
**Severity:** High | **Type:** Design

After `path.join()`, there is no check that the result stays within `/srv/customer-files`. A complete fix requires comparing the resolved absolute path against the allowed root.

```javascript
const fullPath = path.resolve(path.join(DATA_ROOT, name));
if (!fullPath.startsWith(path.resolve(DATA_ROOT))) {
  throw new Error('Access denied: file outside allowed directory');
}
```

**Impact:** Even with input validation, symbolic links or other edge cases could bypass directory restrictions.

---

### 4. High: Inadequate Test Coverage—Smoke Test Validates Nothing (tests/smoke.js)
**Severity:** High | **Type:** Quality Assurance

The smoke test is a stub that logs `'all tests passed'` without executing any actual tests. The README claims tests exercise authentication and file access, but no tests exist.

**Impact:** Zero confidence in:
- Authentication enforcement (token validation)
- File access control boundaries
- Proper rejection of invalid requests
- Regression detection for future changes

**Fix:** Implement actual test cases covering:
- Valid authentication with correct token
- Rejection of missing/invalid tokens
- Successful file retrieval for allowed files
- Path traversal attempts (should fail)
- Out-of-boundary access attempts (should fail)

---

### 5. Medium: Insecure Default Authentication Token (src/server.js:5)
**Severity:** Medium | **Type:** Security

The `ADMIN_TOKEN` defaults to the string `'admin'` if the `ADMIN_TOKEN` environment variable is not set. While the README states production always supplies environment variables, this default creates risk if:
- Environment variables are misconfigured in any deployment
- Development/testing uses defaults that leak into production
- Developers rely on the default locally

**Impact:** Attackers with basic knowledge could authenticate if the environment variable is missing.

**Fix:** Throw an error at startup if `ADMIN_TOKEN` is not set, forcing explicit configuration. Never provide a hardcoded default for security credentials.

---

## Summary

The service has critical path traversal and input validation vulnerabilities that allow arbitrary file read access. Additionally, test coverage is insufficient to catch these issues, and authentication has a weak default. These require immediate remediation before any production deployment.
