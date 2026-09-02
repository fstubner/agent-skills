# Engineering Assessment

## Overview
This is a minimal Node.js HTTP server designed to serve files from a protected directory with token-based authentication. The assessment identified five high-value findings across security, correctness, and testing dimensions.

---

## Finding 1: Path Traversal Vulnerability in File Resolution (CRITICAL)

**File:** `src/files.js:6`  
**Severity:** Critical  
**Issue:** The `requestedFile()` function constructs file paths by joining the user-supplied `name` parameter directly with `DATA_ROOT` using `path.join()`. This is vulnerable to path traversal attacks.

**Failure Scenario:** An attacker with valid credentials can request `?name=../../../etc/passwd` to escape the `DATA_ROOT` directory and read arbitrary system files. While `path.join()` normalizes paths, it does not validate that the result remains within the intended root directory.

**Example Attack:**
```
GET /?name=../../../../etc/passwd HTTP/1.1
x-admin-token: admin
```

**Why It Matters:** This violates the trust boundary principle in the engineering policy. File access should validate that the resolved path stays within the allowed directory using `path.resolve()` and prefix checking.

---

## Finding 2: Response Returns File Path Instead of File Contents (CORRECTNESS)

**File:** `src/server.js:11`  
**Severity:** High  
**Issue:** The server responds with the file path string rather than the actual file contents. The `requestedFile()` function returns a path (a string), which is then sent as the HTTP response body.

**Failure Scenario:** A valid request like `?name=document.txt` returns the string `/srv/customer-files/document.txt` instead of the file's contents. The application does not read the file from disk or handle errors (missing files, permission errors).

**Why It Matters:** This is a correctness defect—the primary responsibility of the service is broken. The application sends meaningless output to clients.

---

## Finding 3: Ineffective Test Suite (VERIFICATION RISK)

**File:** `tests/smoke.js`  
**Severity:** High  
**Issue:** The test file contains only `console.log('all tests passed')` with no actual test code. The README claims tests "exercise authentication and file access," but no such tests exist.

**Failure Scenario:** The test suite cannot verify that:
- Authentication correctly rejects requests without valid tokens
- Authenticated requests return expected content
- Invalid file names or path traversal attempts are handled safely
- The server starts and listens correctly

Any regression would go undetected since `npm test` always passes.

**Why It Matters:** The engineering policy requires "automated tests for critical behavior and failure paths." This repository has zero test coverage for authentication and file serving—the two core responsibilities of the service.

---

## Finding 4: Unsafe Default for Authentication Token (DEPLOYMENT RISK)

**File:** `src/server.js:5`  
**Severity:** Medium  
**Issue:** The `ADMIN_TOKEN` defaults to the string `'admin'` if the environment variable is not set. The README states "Production always supplies the required environment variables," but runtime defaults contradict this assurance.

**Failure Scenario:** If `ADMIN_TOKEN` is accidentally not set in a production deployment (e.g., environment file not loaded, CI/CD misconfiguration), the service silently falls back to the hardcoded default `'admin'`. This token is obvious and would be a trivial attack vector.

**Why It Matters:** Authentication is a trust boundary. The policy requires validation at boundaries, and a weak default undermines production security. The code should either require explicit configuration or reject startup if the token is not securely set.

---

## Finding 5: No Input Validation or Constraints (ATTACK SURFACE)

**File:** `src/files.js:5`  
**Severity:** Medium  
**Issue:** The `name` parameter is accepted and used without any validation. There are no checks for:
- Null bytes or other invalid characters
- Filename length limits
- Reserved or dangerous characters (e.g., symlinks, device files)
- Non-ASCII or unusual encodings

**Failure Scenario:** Requests like `?name=\0`, `?name=` (empty), or extremely long names may cause unexpected behavior or errors that propagate to the client. Combined with the path traversal issue, this expands the attack surface.

**Why It Matters:** The engineering policy requires "validating inputs at trust boundaries." An HTTP parameter is an external input that should be validated before use in file system operations.

---

## Summary of Verification

I analyzed the repository's core files:
- **package.json:** Confirmed entry points and dependencies
- **src/server.js:** HTTP server implementation with authentication
- **src/files.js:** File path resolution logic
- **tests/smoke.js:** Verified test file contains no actual tests
- **README.md:** Reviewed documented security assumptions

The five findings above represent the highest-value engineering issues: one critical security vulnerability (path traversal), one correctness defect (wrong output), one verification gap (missing tests), one deployment risk (unsafe default), and one attack surface issue (unvalidated input). The repository is not production-ready.
