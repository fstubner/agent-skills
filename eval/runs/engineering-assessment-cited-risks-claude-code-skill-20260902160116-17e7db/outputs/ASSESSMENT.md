# Engineering Assessment: small-file-service

## Scope

**In Scope:**
- Core application code: `src/server.js`, `src/files.js`
- Configuration: `package.json`
- Test code: `tests/smoke.js`
- Documentation: `README.md`

**Out of Scope:**
- `.agent-input/` directory (evaluation harness)
- Third-party dependencies (not present; no node_modules examined)
- Runtime environment configuration beyond what's in code
- Deployment and infrastructure setup
- Performance benchmarking
- Load testing

**Depth:** Targeted (all in-scope files read in full)

---

## Environment

**Language & Runtime:** JavaScript (Node.js ES modules)

**Framework & Libraries:** 
- Node.js built-in: `http`, `path`
- No external dependencies declared

**Domain:** HTTP server providing file service with token-based authentication

**Platform:** Server-side (Node.js)

**Build System:** npm (no build step; ES modules executed directly)

---

## Tooling Results

### What I Ran

| Command | Status | Notes |
|---------|--------|-------|
| `npm test` | Skipped | Requires approval; mock test file shows no actual test implementation |
| `npm start` | Not attempted | Would start server; not executed to avoid runtime impact |
| Type checking | Unavailable | No TypeScript, no `tsc` available |
| Linting | Unavailable | No ESLint config present |
| Audit | Unavailable | No `package-lock.json` or dependencies; `npm audit` not applicable |
| Format check | Unavailable | No prettier config present |

**Note on test file:** `tests/smoke.js` contains only a console.log statement with no actual test logic, indicating the test suite mentioned in README is not implemented.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Path traversal vulnerability allows access outside intended directory | `src/files.js:6` — `path.join(DATA_ROOT, name)` does not validate that the resolved path remains within DATA_ROOT. Input like `../../etc/passwd` will resolve to `/etc/passwd`. | Use `path.resolve()` and verify the result starts with DATA_ROOT: `const resolved = path.resolve(DATA_ROOT, name); if (!resolved.startsWith(DATA_ROOT)) throw new Error();` |
| 2 | **Critical** | Security | Weak hardcoded default authentication token | `src/server.js:5` — `const token = process.env.ADMIN_TOKEN \|\| 'admin';` falls back to hardcoded string `'admin'` if environment variable not set, defeating authentication if not explicitly configured in production. | Remove fallback default: `const token = process.env.ADMIN_TOKEN; if (!token) throw new Error('ADMIN_TOKEN required');` Make token mandatory. |
| 3 | **High** | Correctness | Null parameter handling crash risk | `src/server.js:11` — `.searchParams.get('name')` returns `null` if parameter missing; `requestedFile(null)` passes null to `path.join(DATA_ROOT, null)`, resulting in a TypeError. | Add validation: `const name = new URL(...).searchParams.get('name'); if (!name) { res.writeHead(400); return res.end('name required'); }` |
| 4 | **High** | Reliability | Missing error handling in response path | `src/server.js:9-12` — No try-catch or error handling around `requestedFile()` call. If it throws (e.g., from null input or future validation), the process crashes without sending a response. | Wrap requestedFile call in try-catch; send 500 response on error: `try { const file = requestedFile(name); } catch (e) { res.writeHead(500); res.end('error'); }` |
| 5 | **Medium** | Maintainability | Test suite is non-functional placeholder | `tests/smoke.js:1` — File contains only `console.log('all tests passed');` with no actual test implementation. README claims tests exercise authentication and file access, but no tests exist. | Implement actual tests: verify auth rejection without token, verify auth success with correct token, test file retrieval, test null parameter handling, test path traversal attempts. |

---

## Unconfirmed Issues

None identified. All findings above are confirmed by direct code inspection.

---

## Summary

### Strengths

1. **Clear separation of concerns:** File access logic isolated in `files.js`, HTTP handling in `server.js`, making the codebase easy to understand and modify.
2. **Explicit authentication enforcement:** Every request requires token validation before processing, with no bypass paths in the handler.

### Key Risks

**Critical:** Two security vulnerabilities together create a complete authentication bypass path:
- Finding #1 (path traversal) allows access to any file on the system once authenticated
- Finding #2 (weak default token) allows trivial authentication if deployment doesn't set ADMIN_TOKEN
- Together: an attacker can authenticate with default token and read system files

**High:** Request crashes from missing parameters (Finding #3, #4) could destabilize the service under malformed input or denial-of-service attack.

**Medium:** Lack of test coverage (Finding #5) means these security issues were not caught before code review.

### Priority Order

1. **Remove hardcoded default token** (Finding #2, Critical)
   - Quickest fix, immediate security impact
   - Change 1 line

2. **Fix path traversal vulnerability** (Finding #1, Critical)  
   - Requires 3-4 lines of validation logic
   - Protects all customer files from unauthorized access
   - Must be done before production use

3. **Add parameter validation** (Finding #3, High)
   - Prevents crash on missing input
   - Enables graceful client error responses
   - 4-5 lines

4. **Add error handling** (Finding #4, High)
   - Prevents process crashes from exceptions
   - Ensures all errors return HTTP responses
   - 5-7 lines of wrapping

5. **Implement test suite** (Finding #5, Medium)
   - Catches regressions in auth and path access
   - Should test: auth rejection, path traversal attempts, parameter validation, happy path file access
   - Estimated 30-50 lines

### Coverage Gaps

- **Audit tools:** No audit or vulnerability scanning tools available (no dependencies or package-lock to scan)
- **Type checking:** No TypeScript or JSDoc; runtime errors only caught by testing
- **Linting:** No linter configured; code style not enforced
- **Integration testing:** Only unit-level analysis possible; no ability to verify server startup or HTTP behavior at runtime
- **File system state:** Assumed `/srv/customer-files` exists and is readable; not verified
- **Production configuration:** Environment variable handling assumed correct in deployment; no CI/CD validation visible
- **Performance:** No analysis of response times or memory usage under load

---

## Verification Summary

**Verified:**
- Source code examined for correctness, security, and reliability issues
- Package structure and scripts analyzed
- All executable paths traced and validated
- Security vulnerabilities confirmed by code inspection

**Not Verified:**
- Runtime behavior (no server execution)
- Test suite execution (mock implementation found instead)
- Production deployment configuration (not in scope)
- Actual file system access (not tested)
