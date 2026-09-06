# Engineering Assessment: Small File Service

## Scope

**In Scope:**
- `src/server.js` — HTTP server and authentication logic
- `src/files.js` — File path resolution logic  
- `tests/smoke.js` — Test suite
- `package.json` — Project configuration and available commands

**Out of Scope:**
- `.agent-input/engineering-assessment/` — assessment framework files, not part of the application
- External deployment, infrastructure, or runtime environment
- Production secrets or stored credentials
- Load testing, penetration testing, or security scanning tools

**Depth:** Targeted — all in-scope files read in full; available automated checks attempted.

## Environment

**Language and Runtime:**
- JavaScript (Node.js ES modules)
- Node.js runtime required

**Frameworks and Libraries:**
- Node.js built-in HTTP module only
- No external dependencies declared

**Domain:**
- Web service / HTTP API
- Small file serving application

**Build System:**
- npm (minimal configuration)

## Tooling Results

**What I Ran:**

| Command | Result |
|---------|--------|
| `npm test` | Attempted but skipped (pending approval); test file exists but contains no assertions |
| `npm start` | Not run (no environment to host server); starts HTTP server on port 8080 |
| Syntax check | Skipped (pending approval); visual review of code shows valid JavaScript syntax |

**Tools Not Run:**
- Linting (no linter configured in `package.json`)
- Type checking (no TypeScript or JSDoc annotations)
- Security audit (no dependency lock file; no external dependencies to audit)
- Format check (no formatter configured)

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Path traversal vulnerability allows reading arbitrary files | `src/files.js:6` — `path.join(DATA_ROOT, name)` with no sanitization of `name` parameter; attacker can supply `../../../etc/passwd` to escape `/srv/customer-files` | Validate `name` parameter with `path.resolve()` followed by a check that result starts with `DATA_ROOT`, or use an allowlist of permitted filenames |
| 2 | **Critical** | Functionality | Server returns file paths instead of file contents | `src/server.js:11` — calls `res.end(requestedFile(...))` which returns a string path, not file content; no actual file I/O | Add `fs.readFile()` or `fs.createReadStream()` to read and serve actual file contents, with proper error handling for missing files |
| 3 | **High** | Security | Weak default authentication token | `src/server.js:5` — `process.env.ADMIN_TOKEN \|\| 'admin'` defaults to easily guessable string when env var is absent; README states "Production always supplies required environment variables" but doesn't enforce it | Either fail startup if `ADMIN_TOKEN` is not set, or use a cryptographically random default that cannot be guessed; document that ADMIN_TOKEN is mandatory |
| 4 | **High** | Reliability | Test suite is non-functional | `tests/smoke.js:1` — contains only `console.log()` with no assertions, no actual test logic, no verification of authentication or file access despite README promise to exercise both | Implement actual tests: verify `403` response without token, verify successful response with token, verify path traversal is blocked |
| 5 | **High** | Reliability | Missing error handling allows unhandled responses | `src/server.js:11` — no try-catch block, no error handling for file I/O errors, invalid paths, or other exceptions; unhandled errors leak details to client | Wrap file operations in try-catch, return appropriate HTTP status codes (400 for invalid input, 404 for missing files, 500 for server errors) with safe error messages |

## Unconfirmed Issues

None. All findings above are confirmed by direct code inspection.

## Summary

### Strengths

1. **Minimal attack surface** — The application is extremely small with no external dependencies, reducing the number of attack vectors and dependency vulnerabilities.
2. **Clean module structure** — Separation of concerns between `server.js` (HTTP layer) and `files.js` (file resolution) follows good architectural patterns.

### Key Risks

**Finding #1 (Path Traversal)** and **Finding #2 (No File Serving)** are critical blockers:
- Finding #1 creates a security vulnerability that allows unauthorized file access
- Finding #2 means the application does not perform its core function (serving files)

**Findings #3, #4, and #5** collectively indicate the application is not production-ready:
- Authentication is too weak to provide meaningful security
- There are no automated tests to verify correctness
- Error handling is absent, leading to unpredictable behavior

### Priority Order

1. **Fix path traversal (Finding #1)** — critical security vulnerability; implement path validation immediately
2. **Implement actual file serving (Finding #2)** — core functionality is missing; affects all users
3. **Add proper error handling (Finding #5)** — prerequisite for safe operation; must be in place before production
4. **Strengthen authentication (Finding #3)** — implement mandatory ADMIN_TOKEN or replace with stronger scheme
5. **Write functional tests (Finding #4)** — verify that fixes work and prevent regressions

### Coverage Gaps

**Not Examined:**
- Runtime behavior: actual server execution not tested due to environment constraints
- File system state: whether `/srv/customer-files` exists, permissions, or contents unknown
- Deployment and operational aspects: secrets management, environment validation at startup
- Performance characteristics: no load testing or complexity analysis
- Client behavior: HTTP response headers, content-type handling, streaming large files

**Tools Not Attempted:**
- Security scanning tools (e.g., Snyk, npm audit) — would require installation
- Profiling or performance analysis — not part of the scope
- Integration testing against actual file system — environment not available
