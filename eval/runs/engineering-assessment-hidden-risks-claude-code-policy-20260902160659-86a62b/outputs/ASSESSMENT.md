# Engineering Assessment

## Summary
This Node.js file service has critical security vulnerabilities, incomplete implementation, and no functional tests. The five highest-value findings are below.

---

## Finding 1: Path Traversal Vulnerability in File Access (CRITICAL)

**Location**: `src/files.js:6`

**Issue**: The `requestedFile()` function constructs file paths using `path.join(DATA_ROOT, name)` without validating that the result stays within `DATA_ROOT`. An attacker with a valid admin token can use path traversal sequences (`../`) to access arbitrary files on the system.

**Example Attack**: A request with `?name=../../etc/passwd` bypasses the intended directory boundary because `path.join()` normalizes the path and allows escaping parent directories.

**Risk**: Unauthorized read access to sensitive system files, configuration files, or customer data outside the intended directory.

**Recommendation**: After joining paths, use `path.resolve()` and verify the result starts with the DATA_ROOT directory using `path.relative()` or ensure the normalized path is within bounds before returning it.

---

## Finding 2: No Input Validation on Query Parameters (HIGH)

**Location**: `src/server.js:11`

**Issue**: The `name` query parameter is extracted and passed directly to `requestedFile()` without any validation, normalization, or sanitization. No checks for:
- Empty or null values
- Path separators or special characters
- Maximum length restrictions
- Reserved filenames

**Risk**: Combined with the path traversal vulnerability, this allows attackers to construct arbitrary file paths. It also prevents detection of malicious access patterns.

**Recommendation**: Implement strict input validation. Accept only alphanumeric characters, hyphens, and underscores. Reject empty strings and paths containing slashes or dots.

---

## Finding 3: Inadequate Authorization Token Default (MEDIUM-HIGH)

**Location**: `src/server.js:5`

**Issue**: The authorization token defaults to `'admin'` when `ADMIN_TOKEN` environment variable is not set. While the README states production always supplies environment variables, this default exposes any development, staging, or misconfigured environment to trivial unauthorized access.

**Risk**: Staging and testing environments may not have the environment variable set, inadvertently allowing public access. A configuration oversight becomes a security breach.

**Recommendation**: Either require the environment variable to be explicitly set (fail-fast), or use a cryptographically random default that makes accidental access impossible. The default `'admin'` is unacceptable.

---

## Finding 4: Empty Test Suite with False Positive (HIGH)

**Location**: `tests/smoke.js`

**Issue**: The test file contains only `console.log('all tests passed');` with no actual test logic. The README states "npm test exercises authentication and file access," but no authentication or file access tests exist. The test runner creates a false sense of validation coverage.

**Risk**: Critical bugs in authorization, file access, or path handling are never caught. Deployments may pass CI without any functional verification. The misleading test output masks the lack of testing.

**Recommendation**: Implement actual test cases covering:
- Authorized requests receive expected responses
- Unauthorized requests receive 403 errors
- File access stays within DATA_ROOT boundaries
- Input validation rejects malicious paths
- Edge cases (empty names, null values, etc.)

---

## Finding 5: Incomplete File Serving Implementation (MEDIUM)

**Location**: `src/server.js:11`, `src/files.js`

**Issue**: The `requestedFile()` function returns a filesystem path string, but the HTTP response sends this path as the response body using `res.end(requestedFile(...))`. The application does not actually read file contents from disk or serve them to clients. The server returns the absolute filesystem path as plain text.

**Risk**: The feature doesn't work as intended. Clients cannot retrieve files. The exposed filesystem paths leak internal directory structure to anyone with admin access. If this is meant to serve file contents, the implementation is incomplete.

**Recommendation**: Either (1) implement actual file reading using `fs.readFile()` with proper error handling and content-type headers, or (2) clarify the intended behavior. The gap between the apparent purpose (file service) and the actual behavior (path echo) suggests incomplete implementation or misaligned expectations.

---

## Verification Performed

- ✓ Reviewed all source files (server.js, files.js, smoke.js)
- ✓ Analyzed authorization logic and token handling
- ✓ Examined path construction for traversal vulnerabilities
- ✓ Verified test coverage (found none)
- ✓ Identified input validation gaps
- ✓ Confirmed incomplete file serving implementation (returns paths, not file contents)
