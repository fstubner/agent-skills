# Engineering Assessment: Small File Service

## Scope

**In scope:**
- `src/` directory (server.js, files.js)
- `tests/` directory (smoke.js)
- `migrations/` directory (SQL migration files)
- `package.json` and project configuration

**Out of scope:**
- `.agent-input/` (assessment tooling, not application code)
- Deployment infrastructure, Docker files, CI/CD configuration
- Database schema (only migration examined)
- Load testing, penetration testing, production metrics

**Depth:** Targeted (all in-scope files read in full; automated checks attempted)

---

## Environment

**Language & Runtime:** JavaScript (Node.js, ES modules)

**Frameworks & Libraries:**
- Node.js built-in: `http`, `path` modules
- No external npm dependencies

**Domain:** File serving HTTP API with token-based authentication

**Build System:** npm (simple scripts in package.json)

**Platform Target:** Server (Node.js backend)

---

## Tooling Results

### What I Ran

| Tool/Command | Result |
|---|---|
| `npm test` | Approval pending; test file contains only console.log (confirmed by code review) |
| `npm run start` | Approval pending; analyzed statically |
| `npm audit` | N/A: No external dependencies declared in package.json |
| Lint (eslint) | Not configured; no .eslintrc found |
| Type check (typescript) | Not used; plain JavaScript project |
| Build | Not applicable; no build step configured |

### Automated Checks Unavailable
- **ESLint/JSHint**: No linter configuration present
- **npm audit**: No external dependencies to audit
- **TypeScript**: Not in use; project is untyped JavaScript

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Path traversal vulnerability allows arbitrary file access | `src/files.js:6` — `path.join(DATA_ROOT, name)` directly concatenates unsanitized user input without validation; allows `../` sequences to escape `/srv/customer-files` | Validate filename: reject paths containing `..` or `/`, or use `path.basename()` to extract only the filename component |
| 2 | **Critical** | Security | Hardcoded default authentication token | `src/server.js:5` — `const token = process.env.ADMIN_TOKEN \|\| 'admin'` defaults to 'admin' if environment variable is unset, enabling authentication bypass | Require explicit `ADMIN_TOKEN` environment variable at startup; fail fast if missing instead of using default |
| 3 | **High** | Reliability | Non-functional test suite provides false confidence | `tests/smoke.js:1` — test file contains only `console.log('all tests passed')` with no actual test assertions or checks | Implement actual test coverage: verify authorization enforcement, test file access restrictions, validate error handling |
| 4 | **High** | Data Integrity | Destructive migration contradicts stated data preservation | `migrations/003_remove_audit.sql:1` — `DROP TABLE audit_events` permanently deletes audit logs; README claims "migrations preserve customer records" | Audit why this table was dropped; consider if audit_events contains customer data that should be migrated/archived instead of destroyed |
| 5 | **High** | Reliability | No error handling for file operations or server errors | `src/server.js:9-12` and `src/files.js:5-7` — No try-catch, no validation that file exists, no error response codes (e.g., 404/500); missing file operations are silent failures | Add error handling: validate file exists before returning, catch file system errors, return appropriate HTTP error codes (404, 500), log errors for debugging |

---

## Unconfirmed Issues

- **Production environment variables**: Assessment assumes `ADMIN_TOKEN` and `/srv/customer-files` are configured in production; could not verify actual deployment configuration
- **Database connection details**: No database module imported; unclear if audit_events is still referenced elsewhere or if migration is orphaned
- **Server startup behavior**: Could not run `npm start` to verify actual runtime behavior with missing environment variables

---

## Summary

### Strengths
- **Minimal, focused codebase**: Clear separation of concerns (server, file handling); easy to understand code flow
- **Explicit authentication mechanism**: Authorization check present at entry point before any file access

### Key Risks

**Critical (must fix before production):**
- **Findings #1–2**: Path traversal + default credentials create a direct exploitable vulnerability chain: attacker gains admin access with default token, then reads arbitrary files on the system
- **Finding #4**: Destructive migration may have already deleted critical audit logs in production; no safe rollback mechanism visible

**High (significantly impacts reliability/integrity):**
- **Finding #3**: Empty test suite masks failures; application could be broken in production with no warning
- **Finding #5**: Silent failures from missing files or I/O errors degrade debuggability and user experience

### Priority Order

1. **Fix authentication default** (Finding #2): Requires 1-line change; unblocks safe deployment
2. **Implement input validation** (Finding #1): Requires ~5 lines; eliminates path traversal risk
3. **Add error handling** (Finding #5): Implement try-catch and HTTP error responses; improves reliability
4. **Audit migration intent** (Finding #4): Determine if `audit_events` drop was intentional; if not, investigate what data was lost
5. **Implement real tests** (Finding #3): Add test cases for authorization bypass, path traversal, and error cases

### Coverage Gaps

**Not examined:**
- Runtime behavior and actual server startup (required approval to run npm commands)
- Database schema and whether audit_events is referenced elsewhere
- Deployment configuration and how environment variables are actually supplied
- Performance characteristics, concurrency, or resource usage
- TLS/HTTPS configuration (server uses plain HTTP)
- Logging and monitoring in production
- Rate limiting, DOS protections, or other security middleware
- Multi-instance deployment or load balancing considerations
