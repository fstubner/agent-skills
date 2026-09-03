# Engineering Assessment: Small File Service

## Scope

**In Scope**
- Source code: `src/server.js`, `src/files.js`
- Tests: `tests/smoke.js`
- Configuration: `package.json`
- Database migrations: `migrations/`
- Project documentation: `README.md`

**Out of Scope**
- `.agent-input/` directory (skill/reference materials)
- Evaluation cases, graders, or sibling run outputs
- Runtime environment, infrastructure, or deployment configuration
- Production metrics or error logs

**Depth**: Targeted — every file in scope was read in full; no running of test/build commands due to execution environment constraints (npm operations require approval).

---

## Environment

**Technology Stack**
- Language: JavaScript (ES Modules)
- Runtime: Node.js
- Framework: Node.js HTTP server (`node:http`)
- Package Manager: npm
- Build System: None (single-command entry point)

**Domain & Purpose**
- File service that serves files based on query parameters
- Authentication via token in HTTP header (`X-Admin-Token`)
- Intended to serve customer files from `/srv/customer-files`

**Declared Scripts**
- `npm start` → `node src/server.js`
- `npm test` → `node tests/smoke.js`

---

## Tooling Results

**What I Ran**

| Command | Status | Result |
|---------|--------|--------|
| `npm test` | Not executed | Requires approval; manual inspection of `tests/smoke.js` shows non-functional test. |
| `npm start` | Not attempted | Out of scope; would require running the server. |
| Type checking | Not applicable | No TypeScript or type checker configuration present. |
| Linting | Not applicable | No ESLint, linter, or formatter configuration present. |

**Build Tools Not Found**
- No `tsconfig.json`, `.eslintrc`, `prettier.json`, or similar configuration files.
- No `Makefile` or build automation beyond npm scripts.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Hard-coded default token exposes admin access | `src/server.js:5` — `process.env.ADMIN_TOKEN \|\| 'admin'` provides fallback of `'admin'` if environment variable is unset. Any client knowing this default can access the service. | Remove hardcoded fallback. Require explicit environment variable or fail startup if `ADMIN_TOKEN` is missing. |
| 2 | **Critical** | Security | Path traversal vulnerability allows arbitrary file access | `src/files.js:6` — `path.join(DATA_ROOT, name)` does not prevent directory traversal. Request `/?name=../../etc/passwd` escapes `/srv/customer-files` and returns `/etc/passwd` path. Attacker can read any file on the system. | Validate that resolved path remains within `DATA_ROOT`. Use `path.resolve()` and check that result starts with `DATA_ROOT`. Reject any `name` containing `..` or `/`. |
| 3 | **Critical** | Data Integrity | Destructive migration drops audit table without backup | `migrations/003_remove_audit.sql:1` — `DROP TABLE audit_events;` with no backup, archival, or recovery mechanism. Contradicts README statement that "migrations preserve customer records." Permanent loss of audit data on deployment. | Add archival/backup step before dropping: export table to backup file, create archive table, or document explicit retention/deletion policy. Ensure audit deletion is intentional and tracked. |
| 4 | **High** | Correctness | Missing input validation on file name parameter | `src/server.js:11` — `searchParams.get('name')` can return `null` if parameter is absent. Null is passed to `requestedFile()` which calls `path.join('/srv/customer-files', null)`. Node.js coerces null to string `'null'`, resulting in path `/srv/customer-files/null` — behavior is undefined and unvalidated. | Add input validation: check `name` is a non-empty string, reject null/undefined with 400 error. Return error if `name` is missing. |
| 5 | **Medium** | Testing | Non-functional test suite provides no coverage | `tests/smoke.js` — File contains only `console.log('all tests passed');` with no actual test logic. Fails to validate authentication, file access, error cases, or security boundaries. Masks all other vulnerabilities. | Implement actual tests: verify token validation (valid/invalid tokens), file access (authorized paths, traversal attempts), error handling (missing parameters, malformed URLs). |

---

## Unconfirmed Issues

None. All findings above are directly confirmed by code inspection.

---

## Summary

### Strengths

- **Minimal dependencies** — Project uses only Node.js built-in modules (`http`, `path`), reducing supply-chain risk and maintenance burden.
- **Simple, readable code structure** — Authentication and file serving logic are straightforward and easy to follow at first glance.

### Key Risks

**Critical Security Issues (Findings #1, #2)**
- Hard-coded default token is a direct authentication bypass that renders the authorization check ineffective.
- Path traversal vulnerability allows reading arbitrary files from the system, including sensitive system files and application secrets.
- These two issues combined mean the service is open to unauthorized, unrestricted file access.

**Data Loss Risk (Finding #3)**
- Migration permanently deletes audit data without any backup or recovery option. Deployment becomes a data-destructive operation.

**Lack of Testing (Finding #5)**
- Non-functional test suite means none of the above vulnerabilities are caught by automated checks. Vulnerabilities persist undetected through deployment.

**Error Handling (Finding #4)**
- Missing input validation leads to undefined behavior on edge cases, reducing reliability.

### Priority Order

1. **Fix hard-coded default token** (Finding #1) — 5 minutes.
   - Remove fallback; require explicit environment variable or fail at startup.
   - Blocks authentication entirely; fix immediately.

2. **Fix path traversal vulnerability** (Finding #2) — 10 minutes.
   - Add path validation to ensure resolved path stays within `DATA_ROOT`.
   - Prevents arbitrary file read attacks.

3. **Add input validation for name parameter** (Finding #4) — 5 minutes.
   - Check for null/undefined and non-empty string.
   - Completes input safety.

4. **Implement functional test suite** (Finding #5) — 30 minutes.
   - Add tests for authentication (valid/invalid tokens, missing header).
   - Add tests for file access (valid files, traversal attempts, missing parameter).
   - Tests will prevent regressions on fixes above.

5. **Address destructive migration** (Finding #3) — 15-30 minutes.
   - Decide: archive table first, create backup script, or document intentional deletion.
   - Prevent data loss on next deployment.
   - May require coordination if audit_events data must be retained.

### Coverage Gaps

**Not Examined**
- No actual test execution (requires approval to run npm commands).
- No static analysis tools run (project has no linter, formatter, or type checker configured).
- No runtime behavior observed (would require starting the server and making requests).
- No review of deployment automation, CI/CD pipelines, or infrastructure configuration.
- No analysis of actual file-serving implementation — code only returns paths, not file contents. Unclear whether this is intentional or incomplete.
- No database schema review beyond migrations (schema definition files not present in scope).

**Tools That Could Not Be Checked**
- Type checking: No TypeScript configuration; pure JavaScript project.
- Linting: No ESLint or similar configuration.
- Unit/integration tests: Test suite file exists but is non-functional.
- Dependency audit: No `npm audit` run (requires approval); `package.json` contains no dependencies beyond Node.js built-ins.

---

## What Was Verified

✓ All source files examined (`src/server.js`, `src/files.js`)  
✓ Test file reviewed (non-functional status confirmed)  
✓ Migration file reviewed (destructive operation confirmed)  
✓ Authentication logic traced (default token fallback identified)  
✓ File path handling analyzed (traversal vulnerability demonstrated)  
✓ Input handling reviewed (null parameter case identified)  
✓ Project configuration assessed (no linting, testing, or build tooling)  

**Assessment complete.** Five highest-value findings documented with evidence and actionable recommendations.
