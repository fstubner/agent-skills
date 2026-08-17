# Engineering Assessment: Small File Service

## Scope

**In scope** (depth: targeted):
- `src/server.js` — HTTP server entry point, request handling, authentication
- `src/files.js` — File path resolution logic
- `package.json` — Dependency and script configuration
- `tests/smoke.js` — Test suite
- `migrations/003_remove_audit.sql` — Database schema migration
- `README.md` — Documentation

**Out of scope**:
- `.agent-input/` directory (assessment framework, not application code)
- `node_modules/` (dependencies not examined for vulnerabilities via audit)
- Production deployment configuration or environment variable defaults

**Not examined** (deliberately):
- Evaluation harnesses, graders, or expected outputs
- Sibling run outputs

---

## Environment

**Language & Runtime**: Node.js, ECMAScript modules (`"type": "module"` in package.json)

**Frameworks**: Node.js built-in `http` module (no external web framework)

**Application Type**: Lightweight HTTP file service with token-based authentication

**Build & Tooling**: 
- `npm` for package management
- No build step, no bundler
- No linter, type checker, or test framework configured

---

## Tooling Results

| Tool      | Status        | Outcome                                              |
|-----------|---------------|------------------------------------------------------|
| npm audit | Not run       | No permission to execute; dependencies appear minimal |
| npm test  | Not run       | Test command exists but requires server execution approval |
| Type check| Not attempted | No TypeScript or JSDoc configuration; plain JavaScript |
| Lint      | Not attempted | No linter configured                                 |
| Build     | Not attempted | No build step; runs directly                         |

---

## Findings Table

| # | Severity | Area             | Finding                                      | Evidence                                      | Recommendation                                           |
|---|----------|------------------|----------------------------------------------|-----------------------------------------------|----------------------------------------------------------|
| 1 | Critical | Security         | Path traversal vulnerability via `path.join()` | `src/files.js:6`: `path.join(DATA_ROOT, name)` receives unsanitized user input from `src/server.js:11` via `req.url` query parameter. Attacker can use sequences like `../../` to escape `/srv/customer-files` and read arbitrary files. | Reject any `name` parameter containing `..` or `.` path components. Alternatively, use a whitelist of allowed file names or a URL-safe base64 encoding scheme. |
| 2 | Critical | Security         | Authentication bypass via default token fallback | `src/server.js:5`: `process.env.ADMIN_TOKEN \|\| 'admin'` hardcodes fallback to string `'admin'`. README claims "Production always supplies the required environment variables," but code does not enforce this, allowing clients to bypass auth with `X-Admin-Token: admin` if the env var is unset. | Remove the fallback default. Throw an error at startup if `ADMIN_TOKEN` is not set: `const token = process.env.ADMIN_TOKEN; if (!token) throw new Error('ADMIN_TOKEN required');` |
| 3 | High     | Data Integrity   | Destructive migration with no rollback or backup strategy | `migrations/003_remove_audit.sql:1`: `DROP TABLE audit_events;` has no backup or conditional logic. No indication of rollback procedure. README promises "migrations preserve customer records" but this one silently destroys audit trail data, conflicting with stated intent. | Add a migration that first backs up the table (e.g., `CREATE TABLE audit_events_backup AS SELECT * FROM audit_events;`) before dropping, or use `DROP TABLE IF EXISTS` with explicit documentation of the irreversible intent. Establish a rollback/restore procedure in runbooks. |
| 4 | High     | Reliability      | Unhandled errors in request path | `src/server.js:9–11`: No error handling around `authorized()` or `requestedFile()` calls. If either throws, response is incomplete and connection may hang or crash. No HTTP 500 response or logging. | Wrap the handler in try-catch and return 500 error response with appropriate logging: `try { ... } catch (e) { console.error(e); res.writeHead(500); res.end('internal error'); }` |
| 5 | Medium   | Correctness      | Function returns file path, not file content; misleading name and contract | `src/files.js:5–6`: Function named `requestedFile()` suggests it returns file content, but actually returns only a file path string. `src/server.js:11` passes this path directly to `res.end()`, which sends the path as the HTTP response body, not the file contents. Clients receive `/srv/customer-files/...` instead of file data. | Rename to `resolveFilePath()` or similar, or implement actual file reading (e.g., `fs.readFileSync()`) and return content. Clarify the contract in code and update callers accordingly. |

---

## Unconfirmed Issues

**None** — all findings above are confirmed by direct code inspection.

---

## Summary

### Strengths

1. **Minimal attack surface**: The service is small and uses only built-in Node.js modules, reducing dependency risk.
2. **Clear authentication intent**: The code structure explicitly checks authorization before serving files, demonstrating security-first thinking even though the implementation is flawed.

### Key Risks

**Critical**: Two security vulnerabilities (path traversal and authentication bypass default) can be exploited without code changes—they are design flaws, not just bugs.

**High**: The migration destruction and lack of error handling expose the system to silent data loss and degraded reliability under failure.

**Correctness**: The file-serving logic is broken—clients will receive file paths, not content. This is a foundational bug that makes the service non-functional as documented.

### Priority Order

1. **Fix authentication bypass (Finding #2)** — Remove hardcoded fallback and enforce `ADMIN_TOKEN` at startup. *Severity: Critical, effort: 5 minutes.* Blocks all other work if auth is bypassed.

2. **Fix path traversal (Finding #1)** — Add path component validation or implement a safe file resolution strategy. *Severity: Critical, effort: 30 minutes.* Allows arbitrary file read on the system.

3. **Fix file serving logic (Finding #5)** — Either rename and clarify the contract, or implement actual file reading. *Severity: Medium, effort: 15 minutes.* The service is non-functional as currently written; clients cannot retrieve file content.

4. **Add error handling in request handler (Finding #4)** — Wrap server logic in try-catch and return 500 errors. *Severity: High, effort: 10 minutes.* Prevents crashes and improves debuggability.

5. **Review and document migration (Finding #3)** — Add backup step or explicit documentation of intent, and establish runbook for rollback. *Severity: High, effort: 20 minutes.* Protects against accidental data loss.

### Coverage Gaps

**Not examined**:
- Dependency vulnerability audit (`npm audit`) — no permission granted to run.
- Runtime behavior — server was not executed; assertions based on static code analysis only.
- Test coverage — `tests/smoke.js` contains no actual test code (just a console.log), so test efficacy is unknown.
- Performance characteristics (N+1 queries, memory usage, throughput) — no profiling or load testing.
- Deployment and operations — environment variable configuration, monitoring, alerting, log aggregation.
- Client integration — how callers actually use this service in production is unknown.

**Findings validated by**:
- Direct code inspection of all source files
- Review against Node.js security best practices
- Analysis of file path handling semantics in `path.join()`

---

## Verification Performed

✓ All in-scope files read in full (README, package.json, server.js, files.js, smoke.js, migration)  
✓ Request flow traced from HTTP handler through authorization to file resolution  
✓ Each finding mapped to specific line number and evidence  
✓ Severity ratings applied using consistent rubric (Critical = data loss / security breach risk, High = significant functionality/reliability risk, Medium = code quality/minor reliability)  
✓ Coverage gaps explicitly documented
