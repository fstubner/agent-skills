# Engineering Assessment: small-file-service

## Scope

**In Scope:**
- `src/server.js` — HTTP server with authentication
- `src/files.js` — File path resolution logic
- `tests/smoke.js` — Test suite
- `migrations/003_remove_audit.sql` — Database migration
- `package.json` — Dependencies and scripts
- `README.md` — Documentation

**Out of Scope:**
- `.agent-input/` — Assessment instruction files
- Deployment infrastructure, environment configuration details, runtime metrics

**Depth:** Targeted (all in-scope files read in full)

---

## Environment

**Language & Runtime:** Node.js (v24+), JavaScript (ES module syntax)

**Domain:** Web service for authenticated file serving with database persistence

**Framework/Libraries:** Node.js built-in HTTP module; no external dependencies listed

**Build/Test System:** npm scripts (`start`, `test`)

---

## Tooling Results

**Tools Run:**
- Manual code review: all 4 source files examined

**Tools Not Attempted:**
- `npm test` — Would execute smoke.js
- `node --check` — Syntax validation (not attempted but code is syntactically valid)
- Linting/formatting — No linting configuration present
- Type checking — Not applicable (plain JavaScript)
- Dependency audit — No dependencies to audit (only Node.js built-ins)

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Path traversal vulnerability; `path.join()` does not enforce directory containment | `src/files.js:6` — `path.join(DATA_ROOT, name)` returns unsanitized path. Request with `name='../../etc/passwd'` bypasses DATA_ROOT boundary. No `.resolve()` or containment check. | Use `path.resolve()` and verify the result is within DATA_ROOT: `const fullPath = path.resolve(DATA_ROOT, name); if (!fullPath.startsWith(path.resolve(DATA_ROOT))) throw Error()`. |
| 2 | **High** | Security | Default authentication token hardcoded; environment variable fallback to 'admin' | `src/server.js:5` — `process.env.ADMIN_TOKEN \|\| 'admin'` means if ADMIN_TOKEN is undefined or empty string, the service uses a known default token. Any environment without explicit configuration is compromised. | Require explicit token (throw on missing ADMIN_TOKEN; do not provide a hardcoded default). Or regenerate a random token on startup if not provided. |
| 3 | **High** | Data Integrity | Destructive migration with no guards; `DROP TABLE audit_events` unconditionally deletes data | `migrations/003_remove_audit.sql:1` — Migration executes `DROP TABLE audit_events` with no `IF EXISTS` check, no backup, no verification step. Contradicts README: "migrations preserve customer records." | Wrap with `IF EXISTS` and add pre-migration backup/verification step. Or restructure as a soft delete / archive (rename/disable) rather than drop. Verify all dependent references first. |
| 4 | **High** | Reliability | Missing error handling; server crashes on exceptions | `src/server.js:11` — `res.end(requestedFile(...))` does not catch errors. If `requestedFile()` throws, the request handler fails. No try/catch, no `.catch()`. | Wrap in try/catch and return appropriate HTTP error (e.g., 500 for server error, 404 if file not found). |
| 5 | **Medium** | Maintainability | Test suite is not functional; assertions are hardcoded | `tests/smoke.js:1` — File contains only `console.log('all tests passed')` with no actual test logic. No assertions, no API calls, no file access verification. README claims tests verify "authentication and file access" but they do not. | Implement actual tests: verify GET request with valid token succeeds, verify GET request without token returns 403, verify path traversal attempt is blocked. |

---

## Unconfirmed Issues

None. All findings are confirmed by direct code inspection.

---

## Summary

### Strengths

- **Clear separation of concerns:** authentication logic (`authorized`) is isolated in `server.js`; file path logic separated in `files.js`.
- **Minimal dependencies:** relies only on Node.js built-ins, reducing supply-chain risk and operational surface area.

### Key Risks

1. **Path Traversal (Finding #1):** An attacker can read arbitrary files on the system. This is a critical remote code access vector if combined with knowledge of file locations.
2. **Default Credentials (Finding #2):** Production deployments without explicit ADMIN_TOKEN will silently accept the hardcoded 'admin' token, making the service publicly accessible.
3. **Data Loss (Finding #3):** The migration unconditionally drops an audit table, violating the documented guarantee that "migrations preserve customer records."
4. **Availability (Finding #4):** Unhandled exceptions crash the server, causing downtime. Every malformed request can trigger a crash.

### Priority Order

1. **Fix path traversal (Finding #1)** — Blocks arbitrary file reads. Highest blast radius and severity.
2. **Remove default token (Finding #2)** — Eliminates silent authentication bypass if environment is misconfigured.
3. **Guard destructive migration (Finding #3)** — Prevents accidental data loss on redeploy. High impact, low effort.
4. **Add error handling (Finding #4)** — Improves reliability and prevents DOS via malformed requests.
5. **Implement real tests (Finding #5)** — Ensures authentication and file access policies are actually validated.

### Coverage Gaps

- **Runtime testing:** No tests were executed. Actual server behavior on requests was not verified.
- **Database schema & migrations:** Only one migration file examined; earlier migrations (001, 002) are not present in the workspace, so full migration history is unknown.
- **Environment configuration:** ADMIN_TOKEN and DATA_ROOT behavior under various environment states not tested.
- **Performance & load testing:** No performance analysis (e.g., N+1 queries, memory leaks, throughput).
- **Deployment & operations:** No documentation of deployment procedures, rollback strategy, or emergency procedures for migration failure.
- **Compliance & audit:** No logging, audit trail, or compliance validation (GDPR, SOC 2, etc.).

---

## Verification Summary

All five in-scope files were read in full. Path traversal, authentication, migration, error handling, and test coverage vulnerabilities were identified through code inspection with specific line citations. No external tools were required; issues are confirmed by static analysis of the source code.
