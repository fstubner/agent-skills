# Engineering Assessment: Small File Service

## Scope

**In scope:**
- `src/server.js` - HTTP server with authentication
- `src/files.js` - File path construction
- `tests/smoke.js` - Test suite
- `migrations/003_remove_audit.sql` - Database migration
- `package.json` - Project configuration and scripts

**Out of scope:**
- `.agent-input/` - Assessment framework files
- External service interactions (not present in code)
- Production deployment configuration
- Infrastructure and networking setup

**Depth:** Targeted — all in-scope files read in full; automated checks attempted but require approval.

---

## Environment

**Language & Runtime:** JavaScript (Node.js v24.14.1), ES modules

**Framework & Architecture:** Native Node.js `http` module; HTTP server with file serving capability

**Domain:** HTTP API service for authenticated file access with customer data persistence

**Build/Test System:** npm scripts (`npm start`, `npm test`)

**Automated checks attempted:**
- `npm test` — Requires approval (available but not executed)
- `npm start` — Requires approval (available but not executed)
- Source code analysis completed without execution

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Security | Hardcoded default authentication token exposes all clients to default credential attack | `src/server.js:5` — `const token = process.env.ADMIN_TOKEN \|\| 'admin';` Fallback to 'admin' if env var unset | Remove default token. Require ADMIN_TOKEN to be explicitly set; reject requests if undefined. Fail-secure on startup if env var is missing. |
| 2 | Critical | Security | Path traversal vulnerability in file path construction allows access outside intended directory | `src/files.js:6` — `path.join(DATA_ROOT, name)` permits `../` sequences to escape `/srv/customer-files`. Example: `?name=../../etc/passwd` resolves to `/etc/passwd` | Implement whitelist validation: reject names containing `..`, `/`, or absolute paths. Use `path.resolve()` + comparison to ensure result stays within DATA_ROOT. |
| 3 | High | Reliability | Test suite is non-functional; labeled as exercising authentication and file access but contains no assertions | `tests/smoke.js:1` — File only contains `console.log('all tests passed');` with no actual test code. Contradicts README claim that tests exercise auth and file access | Replace with comprehensive test suite: test auth success/failure cases, test file access with valid/invalid paths, test migration safety. |
| 4 | High | Data Integrity | Destructive migration drops audit table unconditionally with no rollback protection or backup verification | `migrations/003_remove_audit.sql:1` — Unconditional `DROP TABLE audit_events;` with no `IF EXISTS`, no conditional guard, no rollback script. README states migrations preserve customer records | Add pre-migration backup step documented in README. Add `IF EXISTS` guard. Create explicit rollback migration. Add explicit approval gate in migration runner. |
| 5 | High | Security | Missing input validation on URL query parameter allows malformed or malicious input to be processed unfiltered | `src/server.js:11` — `.searchParams.get('name')` passed directly to `requestedFile()` with no validation for null, undefined, empty string, or type | Validate query parameter: reject if null/undefined, reject if length > 255, reject if not a string, reject before parsing. Normalize input. |

---

## Unconfirmed Issues

**Incomplete file serving implementation:** The server constructs file paths via `requestedFile()` but passes the path string directly to `res.end()`, serving the path itself rather than file contents. This appears to be either incomplete implementation or path disclosure. Cannot confirm intent without additional context (e.g., commit history, design docs).

---

## Summary

### Strengths

1. **Minimal and focused codebase:** The project has a clear, simple structure with no unnecessary dependencies or layers, making the attack surface and complexity easy to reason about.

2. **Explicit environment configuration:** The project uses environment variables for auth token (even though the default is weak), demonstrating intent to externalize secrets.

### Key Risks

**Critical security gaps (Findings 1–2):** Default auth token and path traversal vulnerability create a direct path to unauthorized file access. Together, these represent a complete authentication and authorization bypass with minimal effort to exploit.

**Test and migration blindness (Findings 3–4):** No functional tests mean failures in auth and file access paths go undetected. Destructive migration without rollback or backup protection risks irreversible data loss.

**Input validation gap (Finding 5):** Compounds the path traversal issue and creates fragility in the file serving logic.

### Priority Order

1. **Fix hardcoded auth token (Finding 1)** — Quick fix, eliminates default credential exposure. Implement within one sprint. 
2. **Implement path validation (Finding 2)** — High impact, blocks all path traversal variants. Use whitelist approach (reject `..`, `/`) plus post-join verification.
3. **Add input validation (Finding 5)** — Reduces attack surface and catches malformed requests early. Implement same time as Finding 2.
4. **Build functional test suite (Finding 3)** — Prevents regression. Write tests for auth (success/failure), path validation (in/out of bounds), and query parameter edge cases.
5. **Add migration safeguards (Finding 4)** — Lower urgency if migrations are rarely run; higher if this is an active codebase. Add backup, rollback, and approval gate.

### Coverage Gaps

- **Tests not executed:** The `npm test` command could not be run (requires approval); test output not available to verify implementation soundness.
- **No integration tests:** Manual testing of HTTP request/response flow not performed; auth, path resolution, and error handling verified only through source code inspection.
- **No performance or load testing:** Not attempted.
- **No deployment configuration:** Production environment setup, database connection, file system permissions not examined.
- **No migration runner examined:** The tool/process that executes `migrations/003_remove_audit.sql` not reviewed; cannot verify if safeguards exist at execution layer.
- **Commit history not reviewed:** Reasons for design decisions, prior issues, or context not available.
- **Database schema not visible:** Impact of `DROP TABLE audit_events` cannot be fully assessed without schema and data model.

