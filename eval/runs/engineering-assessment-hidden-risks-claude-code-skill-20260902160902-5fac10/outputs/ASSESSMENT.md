# Engineering Assessment: small-file-service

## Scope

**In Scope:**
- `src/` directory (server and file handling logic)
- `tests/` directory (test suite)
- `migrations/` directory (database migrations)
- `package.json` (dependencies and scripts)
- README.md (documentation and requirements)

**Out of Scope:**
- `.agent-input/engineering-assessment/` (assessment framework files)
- External services, infrastructure configuration, or deployment setup
- Production monitoring or observability systems

**Depth:** Targeted (all in-scope files read in full)

---

## Environment

**Language & Runtime:** Node.js (ES modules)  
**Framework:** Node.js built-in `http` module  
**Domain:** File serving service with authentication  
**Platform:** Server-side service listening on port 8080  
**Build System:** npm  
**Key Technologies:** Node.js native modules only (no external dependencies)

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | Not executed (requires approval). Test script references `tests/smoke.js` which only contains a single console.log with no actual test assertions. |
| Manual code inspection | Completed on all in-scope files. |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Path traversal vulnerability allows directory escape | `src/server.js:11` passes untrusted query parameter `name` directly to `requestedFile()`, which uses `path.join(DATA_ROOT, name)` in `src/files.js:6` without validation. Attacker can use `name=../../../etc/passwd` to escape DATA_ROOT. | Validate resolved path using `path.resolve()` and confirm it starts with `DATA_ROOT`. Reject any paths containing `..` or that resolve outside the allowed directory. |
| 2 | **Critical** | Security | Weak default authentication enables bypass | `src/server.js:5` contains fallback `process.env.ADMIN_TOKEN \|\| 'admin'`, hardcoding 'admin' as token if environment variable is missing. In production, any missing env var results in predictable token. | Remove the fallback entirely; require ADMIN_TOKEN to be explicitly set. Throw an error or refuse to start if the environment variable is not defined. |
| 3 | **High** | Correctness | File contents not returned; only path string sent | `src/files.js:6` returns a filesystem path string; `src/server.js:11` calls `res.end(requestedFile(...))` which sends the path string to the client instead of file contents. Test file never exercises actual file serving, so issue remains undetected. | Read actual file contents using `fs.readFileSync()` or `fs.promises.readFile()` before sending to client. Handle ENOENT and permission errors. |
| 4 | **High** | Reliability | No error handling; crashes on missing files or read failures | `src/server.js:9-12` has no try-catch, `.catch()`, or error handlers. Missing files, permission errors, or I/O failures will cause unhandled exceptions and crash the process. | Wrap file operations in try-catch; respond with appropriate HTTP status codes (404 for missing files, 500 for server errors, 403 for permission denied). |
| 5 | **High** | Maintainability | Test suite does not test anything | `tests/smoke.js:1` contains only `console.log('all tests passed')` with zero test assertions or actual code execution. No coverage of authentication, file access, path traversal, or error cases. | Implement actual tests: verify authentication enforcement, confirm file contents are returned correctly, test path traversal prevention, and validate error responses. |

---

## Unconfirmed Issues

None. All findings above have concrete code evidence.

---

## Summary

### Strengths

1. **Minimal dependencies**: The service uses only Node.js built-in modules (`http`, `path`), reducing supply-chain attack surface and keeping the codebase simple.
2. **Clear authentication pattern**: The authorization check is placed at the server level before processing any requests, showing intent to gate access.

### Key Risks

The service contains **three critical-to-high severity issues** that make it unsuitable for production:

1. **Findings #1 & #2** (Critical): Security vulnerabilities in authentication and path handling that allow attackers to either bypass authentication or access arbitrary files on the filesystem.
2. **Finding #3** (High): Core functionality is broken—files are not actually served; only paths are returned.
3. **Finding #4** (High): Complete absence of error handling will cause the service to crash on common failure conditions.
4. **Finding #5** (High): Test suite provides zero coverage, masking all of the above issues.

### Priority Order

1. **Fix path traversal vulnerability** (Finding #1)  
   - Highest blast radius; any attacker can read arbitrary files.  
   - Moderate effort; add path validation before file access.

2. **Remove hardcoded authentication fallback** (Finding #2)  
   - High severity; authentication bypass if env var missing.  
   - Minimal effort; remove the `||` fallback operator.

3. **Implement actual file reading** (Finding #3)  
   - Blocks core functionality; service does not work as intended.  
   - Low effort; use `fs.readFileSync()` and send file contents.

4. **Add error handling** (Finding #4)  
   - Prevents crashes; improves reliability.  
   - Low-to-moderate effort; wrap operations in try-catch and send HTTP error responses.

5. **Implement real tests** (Finding #5)  
   - Enables detection of future regressions; validates fixes for issues #1–4.  
   - Moderate effort; write assertions for auth, file serving, security, and error cases.

### Coverage Gaps

- **Build/lint tooling**: No build, lint, or type-checking tools are configured. ESLint, Node type checking (via JSDoc), or TypeScript would catch some issues.
- **Integration testing**: Only smoke tests are defined; no integration tests that verify the service behavior end-to-end.
- **Database concerns**: Migration file exists (`migrations/003_remove_audit.sql`) but no database integration code found in the application; unclear if migrations are applied and how they interact with the service.
- **Load/performance testing**: No performance benchmarks or load testing; unknown behavior under concurrent load.
- **Security scanning**: No automated security scanning (e.g., npm audit) was run; unknown if dependencies have known vulnerabilities (though none are declared).

---

## What I Verified

- **All source files read in full**: `server.js`, `files.js`, `smoke.js` examined for correctness, security, and error handling.
- **Path traversal vulnerability confirmed**: Manual trace of user input from query string through both functions shows no validation.
- **Authentication weakness confirmed**: Hardcoded fallback token is explicit in code.
- **File serving broken confirmed**: Code path returns a string path instead of file contents.
- **Error handling gap confirmed**: No try-catch, error callbacks, or error response handling in the server.
- **Test suite gap confirmed**: Test file contains only a console.log with no assertions.
