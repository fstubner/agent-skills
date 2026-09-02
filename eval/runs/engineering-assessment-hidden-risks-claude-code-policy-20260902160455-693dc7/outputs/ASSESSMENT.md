# Engineering Assessment

## Overview
This is a small Node.js HTTP file service (20 lines of code) that serves files to authorized clients via an admin token. The assessment identified five critical findings across security, functionality, and testing dimensions.

---

## Finding 1: Path Traversal Vulnerability (CRITICAL)

**Location:** `src/files.js:6` — `requestedFile()` function

**Summary:** User-supplied file names can escape the intended `DATA_ROOT` directory via path traversal.

**Failure Scenario:**
```
GET /?name=../../../etc/passwd with valid token
→ Returns "/srv/customer-files/../../../etc/passwd"
→ Attacker reads arbitrary system files
```

**Impact:** Complete compromise of file confidentiality; attacker can read any file accessible to the Node.js process (system configs, other customer data, private keys).

**Root Cause:** `path.join(DATA_ROOT, name)` concatenates unsanitized user input. The Node.js `path.join()` does not prevent directory traversal—it normalizes paths but does not restrict to a base directory.

**Engineering Policy Violation:** "Validate inputs and authorization at trust boundaries" — the file name is never validated.

---

## Finding 2: Incomplete File Serving Implementation (CRITICAL)

**Location:** `src/server.js:11` — `res.end(requestedFile(...))`

**Summary:** The endpoint returns a filesystem path string instead of the actual file content.

**Failure Scenario:**
```
GET /?name=document.pdf with valid token
→ Response body: "/srv/customer-files/document.pdf"
→ Client receives the path, not the file
```

**Impact:** Core functionality broken; service does not actually deliver files to clients, only reveals internal filesystem paths.

**Root Cause:** `requestedFile()` returns `path.join(...)` (a string path), and the server sends this string as the response body without reading or serving the file content.

**Engineering Policy Violation:** "Run the product, tests, and build before claiming completion" — the product does not meet its stated purpose.

---

## Finding 3: Default Token Fallback is Predictable (HIGH)

**Location:** `src/server.js:5` — `authorized()` function

**Summary:** If `ADMIN_TOKEN` environment variable is not set, the fallback defaults to the hardcoded string `'admin'`.

**Failure Scenario:**
```
Environment: ADMIN_TOKEN not set (common in local dev or deployment errors)
→ Default token = 'admin'
→ Attacker sends: X-Admin-Token: admin
→ Authorization passes
```

**Impact:** If production deployment forgets to set `ADMIN_TOKEN`, the service is unprotected with a predictable, publicly-known default credential.

**Engineering Policy Violation:** "Validate inputs and authorization at trust boundaries" — the token should require explicit configuration without a weak default.

---

## Finding 4: No Test Coverage (HIGH)

**Location:** `tests/smoke.js`

**Summary:** The test suite consists of a single console.log statement with no assertions, test cases, or validation.

**Failure Scenario:**
```
$ npm test
→ Output: "all tests passed"
→ No authorization checks validated
→ No file access scenarios tested
→ No error cases verified
```

**Impact:** Developers receive false confidence; breaking changes to authorization or file access go undetected. Undermines the reliability commitment in README ("npm test exercises authentication and file access").

**Engineering Policy Violation:** "Add focused automated tests for critical behavior and failure paths" — no critical behavior is tested. "Run the product, tests, and build before claiming completion" — tests don't actually validate the claims.

---

## Finding 5: Missing Input Validation and HTTP Method Enforcement (MEDIUM-HIGH)

**Location:** `src/server.js:11` — parameter extraction and handler

**Summary:** The `name` query parameter is extracted without validation, and no HTTP method check restricts the endpoint to GET.

**Failure Scenario:**
```
Case A: POST /?name=file.txt with valid token
→ Handler executes; method not checked
→ Unexpected PUT/DELETE could reach the handler in future versions

Case B: GET /?name= with valid token
→ name is empty string or undefined
→ requestedFile() receives falsy input; behavior undefined
→ Could cause crash or unintended path resolution
```

**Impact:** 
- No protection against request methods that shouldn't be supported (POST, PUT, DELETE).
- Missing input presence and type checks allow malformed requests to reach file logic.
- Error responses not defined (no 400, 404, 500 status codes).

**Engineering Policy Violation:** "Validate inputs and authorization at trust boundaries" — the name parameter is never validated for presence or format. "Clarify material unknowns before committing to architecture" — error cases are not defined.

---

## Verification Summary

**What was verified:**
- Source code static analysis of all three application files (server.js, files.js, smoke.js)
- Path handling and file serving logic integrity
- Authorization token flow and fallback behavior
- Test suite completeness against stated functionality in README
- Input validation and HTTP method handling at request entry point

**What remains uncertain:**
- Whether `/srv/customer-files` directory permissions are configured to limit exposure
- Whether the application ever actually reads file contents (code suggests no, but environment/deployment details unclear)
- How migrations are run and whether audit_events table recovery is planned
- Expected behavior when files don't exist or requests lack required parameters
