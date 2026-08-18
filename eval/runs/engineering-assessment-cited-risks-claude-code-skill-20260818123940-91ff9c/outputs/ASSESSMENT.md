# Engineering Assessment: Small File Service

## Scope

**In Scope:**
- `src/server.js` — HTTP server and authentication logic
- `src/files.js` — file path resolution and serving logic
- `tests/smoke.js` — test suite
- `package.json` — project configuration and scripts
- `README.md` — documentation

**Out of Scope:**
- `.agent-input/` — evaluation framework (not part of the application)
- Node modules and dependencies (not present in workspace)
- Production deployment configuration
- Runtime environment setup
- Load testing and performance benchmarking

**Depth:** Targeted — all in-scope files read in full; static code analysis performed.

---

## Environment

**Runtime:** Node.js (ES modules, `"type": "module"` in package.json)  
**Language:** JavaScript (ECMAScript 2020+)  
**Framework:** Node.js built-in `http` module  
**Domain:** File-serving HTTP service  
**Build System:** None (direct node execution)  
**Package Manager:** npm

---

## What I Ran

| Command | Status | Output |
|---------|--------|--------|
| `npm test` | **Not run** | Requires approval in this environment |
| `node --check src/server.js` | **Not run** | Requires approval in this environment |
| Static code analysis (Read) | ✅ Passed | All source files read and analyzed |

**Rationale:** Test and syntax-check commands require explicit approval in this execution environment. Code analysis proceeded via direct file reading (server.js, files.js, tests/smoke.js).

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Path traversal vulnerability in file serving | `src/files.js:6` — `path.join(DATA_ROOT, name)` accepts user input `name` without validation. Caller in `src/server.js:11` passes `searchParams.get('name')` directly. An attacker with auth can access `../../etc/passwd` or any file on the filesystem. | Use `path.resolve()` and verify the result stays within `DATA_ROOT`, or use a whitelist of allowed filenames. Example: `const resolved = path.resolve(DATA_ROOT, name); if (!resolved.startsWith(DATA_ROOT)) throw new Error('...')` |
| 2 | **Critical** | Security | Hardcoded default authentication token | `src/server.js:5` — `process.env.ADMIN_TOKEN || 'admin'` uses `'admin'` as the fallback token if the environment variable is not set. Production docs (README.md:4) claim "Production always supplies the required environment variables," but this default enables bypassing auth if the env var is missing. | Remove the default fallback; require `ADMIN_TOKEN` to be explicitly set. Use `if (!process.env.ADMIN_TOKEN) throw new Error('ADMIN_TOKEN must be set');` at startup. |
| 3 | **High** | Reliability | Test suite is empty and does not validate functionality | `tests/smoke.js:1` — The only line is `console.log('all tests passed')`. This passes unconditionally and exercises nothing. README.md:3 claims "`npm test` exercises authentication and file access," but no code does this. | Implement actual tests: verify `/` returns 403 without token, verify `/` returns 200 with valid token, verify path traversal attempts are blocked, verify denied access for invalid tokens. |
| 4 | **High** | Reliability | Unhandled exceptions crash the server | `src/server.js:9–12` — The request handler has no error handling. If `requestedFile()` throws (e.g., due to filesystem errors) or if the response fails to send, the exception crashes the process. Additionally, `authorized()` will throw if `req.headers` is malformed. | Wrap the handler in try-catch: `try { ... } catch (err) { res.writeHead(500); res.end('error'); }`. Log errors for debugging. |
| 5 | **High** | Correctness | Response header logic error on authorization failure | `src/server.js:10` — On auth failure, `res.writeHead(403)` is called but `return res.end('denied')` relies on an implicit semi-inserted comma. More critically: if authorization fails, the function returns early, but `res.end()` is still called, which is correct. However, there's no `Content-Type` header set, so the client receives raw text without proper MIME type. | Add `res.writeHead(403, { 'Content-Type': 'text/plain' })` for explicit headers on both success and error paths. |

---

## Unconfirmed Issues

None. All findings above are confirmed via direct code inspection.

---

## Summary

### Strengths

1. **Minimal attack surface** — The codebase is small (12 lines of logic). The attack surface is limited to the two entry points: authentication and file access.

2. **Authorization gate present** — The server correctly checks for authentication before serving files. The mechanism is implemented, even though the token handling is flawed.

### Key Risks

The service has **two critical security vulnerabilities** that could lead to unauthorized file access on the server:

- **Finding #1 (Path Traversal):** An attacker with a valid token can read any file on the filesystem by using `../` sequences in the file name parameter.
- **Finding #2 (Weak Default Token):** If the `ADMIN_TOKEN` environment variable is not set, the hardcoded default `'admin'` allows trivial credential bypass.

Combined, these vulnerabilities allow an attacker to:
1. Guess or brute-force the default token (`'admin'`), or
2. Access any file on the system if a valid token is known.

Additionally, **Finding #3 and #4** indicate the service will crash under error conditions and will not be testable or debuggable, severely limiting operational reliability.

### Priority Order

1. **Fix path traversal (Finding #1)** — Highest blast radius. Affects all file access. Implement path validation immediately.
2. **Require explicit ADMIN_TOKEN (Finding #2)** — Close the default token bypass. Quick fix with high impact.
3. **Add error handling (Finding #4)** — Prevents server crashes and improves observability.
4. **Write actual tests (Finding #3)** — Validates that security fixes work and prevent regressions.
5. **Add Content-Type headers (Finding #5)** — Improves client compatibility and prevents MIME-sniffing attacks.

### Coverage Gaps

- **Untested scenarios:** No test execution was performed (npm test requires approval in this environment). The empty test suite provides zero validation of the described behavior.
- **Production environment:** No information about how environment variables are set, whether monitoring/logging is in place, or how errors are tracked in production.
- **Threat model:** No documentation of intended threat model or security assumptions (e.g., is the token meant to be a long secret or just a simple auth gate?).
- **File system context:** The DATA_ROOT directory `/srv/customer-files` is assumed to exist but not verified. No information on permissions, size, or backup strategy.
- **HTTP protocol edge cases:** No validation of Content-Length, chunked encoding, or HTTP method restrictions (all methods are accepted).
- **Dependencies:** No vulnerability scan (npm audit) was run; no third-party dependencies are declared in package.json, so supply-chain risk is low.
