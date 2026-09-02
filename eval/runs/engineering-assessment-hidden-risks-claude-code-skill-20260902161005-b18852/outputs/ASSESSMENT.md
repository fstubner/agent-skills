# Engineering Assessment: Small File Service

## Scope

**In Scope (Depth: Targeted)**
- All application code: `src/server.js`, `src/files.js`
- All test code: `tests/smoke.js`
- All migrations: `migrations/003_remove_audit.sql`
- Project configuration: `package.json`, `README.md`

**Out of Scope**
- Runtime environment configuration and deployment (assumed correct per README)
- Actual file system at `/srv/customer-files` (cannot be verified in this environment)
- Network/TLS layer security (only application logic examined)
- Performance profiling or load testing

**Depth**: Targeted — every in-scope file read in full; available checks attempted.

---

## Environment

**Language & Runtime**: JavaScript (Node.js ES modules)  
**Domain**: HTTP-based file service with token authentication  
**Platform Target**: Server (Linux, assumes `/srv/` paths)  
**Build/Test Tools**: npm with `test` and `start` scripts  
**Key Dependencies**: Node.js built-in modules only (`http`, `path`)

---

## What I Ran

| Command | Status | Output/Result |
|---------|--------|---------------|
| `node tests/smoke.js` | Requested approval | Not executed (requires user approval); would verify test behavior |
| `npm test` | Requested approval | Not executed (requires user approval); test file exists at `tests/smoke.js` |
| File enumeration | ✓ Success | 6 files found: README.md, package.json, 3 source files, 1 migration |
| Code review | ✓ Success | All source files read and analyzed (see Findings) |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Security | Path traversal vulnerability allows escaping file root directory | `src/files.js:6` — `path.join(DATA_ROOT, name)` accepts user input without validation; `path.join()` normalizes `../` segments, so `name='../../etc/passwd'` will escape `/srv/customer-files` and access system files | Validate `name` parameter to reject `..` and absolute paths. Use `path.resolve(DATA_ROOT, name); path.relative(DATA_ROOT, resolved)` and reject if result starts with `..`. |
| 2 | Critical | Security | Default hardcoded authentication token exposes all files if environment variable not set | `src/server.js:5` — `const token = process.env.ADMIN_TOKEN \|\| 'admin';` falls back to hardcoded string `'admin'` if `ADMIN_TOKEN` env var is missing; any client can then authenticate with `x-admin-token: admin` header despite README claiming "Production always supplies the required environment variables" | Remove fallback default. Instead: `throw new Error('ADMIN_TOKEN env var required')` at startup if not provided, or require explicit authentication mechanism at deploy time. Never ship code with default credentials. |
| 3 | High | Correctness | File service returns file path instead of file contents | `src/server.js:11` — `res.end(requestedFile(...))` sends the string returned by `requestedFile()` (a file path like `/srv/customer-files/foo.txt`) as the HTTP response body, not the actual file contents | Replace with `fs.readFile(requestedFile(...), (err, data) => { if (err) res.writeHead(404); res.end(data); })` or equivalent async read to send actual file contents. |
| 4 | High | Reliability | Test file contains no assertions despite README claiming tests exercise authentication and file access | `tests/smoke.js:1-2` — file only logs `'all tests passed'` with no actual test code, assertions, or checks; README.md states "npm test exercises authentication and file access" but test is empty | Implement actual tests: test authorized request with valid token succeeds, test unauthorized request with missing/invalid token returns 403, test path traversal attempts are blocked. Use `assert` module or `node:test`. |
| 5 | High | Data Integrity | Migration drops table destructively with no apparent backup strategy mentioned | `migrations/003_remove_audit.sql:1` — `DROP TABLE audit_events;` is permanently destructive; unclear if this table contains customer records (README says "migrations preserve customer records" but this migration drops one); no associated backup, rename-to-archive, or archival migration visible | Clarify audit_events purpose: does it contain customer data? If yes: implement a data preservation step (e.g., export to archive table before drop, backup to file). Document the retention policy. If no: add a comment explaining why this table was dropped to prevent confusion. |

---

## Unconfirmed Issues

**None**. All findings above are confirmed via direct code inspection.

---

## Summary

### Strengths

1. **Minimal dependency footprint**: Application uses only Node.js built-in modules (`http`, `path`), reducing supply-chain risk and attack surface.
2. **Simple authentication mechanism**: Token-based header validation is easy to understand and reason about (though currently insecure).

### Key Risks

**Critical (Security)**
- **#1 & #2**: Path traversal + default credentials form a one-two punch: even if path traversal is fixed, default credentials allow unauthenticated file access to DATA_ROOT. Even if credentials are fixed, path traversal exposes files outside DATA_ROOT.

**High (Functionality & Reliability)**
- **#3**: Core feature is broken — file service doesn't serve files. Any client receives file paths as plaintext response, not actual file contents.
- **#4**: No working tests mean these bugs are undetected. Test file is a false positive (passes but is empty).
- **#5**: Destructive migration without clarity on data preservation; reversing this requires database restore.

### Priority Order

1. **Fix path traversal (#1)** — Validation of `name` parameter; low effort, blocks access to system files.
2. **Remove default credentials (#2)** — Delete fallback, require explicit env var; low effort, closes authentication bypass.
3. **Implement actual tests (#4)** — Add test cases for auth and path validation; catches future regressions.
4. **Fix file serving (#3)** — Replace path return with actual file read; moderate effort, restores core functionality.
5. **Clarify and secure migration (#5)** — Document audit_events; ensure backup if needed, or add archival step.

All Critical and High issues should be addressed before any production use.

### Coverage Gaps

- **Runtime execution not verified**: Test file could not be executed to confirm current behavior; all findings based on code inspection.
- **Actual file system state not checked**: `/srv/customer-files` directory, permissions, and contents not verified (environment limitation).
- **Migration history not examined**: Only `003_remove_audit.sql` present; no information on migrations `001`, `002`, or whether audit_events existed before.
- **Environment variable handling**: Behavior under various env var states (empty string, unset, malformed) not tested.
- **Error handling**: No `catch` blocks or error responses in server; behavior on malformed requests not examined.
- **Horizontal scalability**: Single-threaded Node.js server; no clustering or load-balancing config examined.

---

## Verification

✓ All source files (3) read in full  
✓ Test file (1) read and analyzed  
✓ Migration file (1) read and analyzed  
✓ Configuration files (2: package.json, README.md) examined  
✓ Five highest-value findings identified and prioritized by severity and blast radius  
✓ Every finding cites specific line numbers and code context  
✓ Severity ratings applied per rubric (Critical for data loss/security breach risk; High for significant functionality/reliability risk)  
✓ Recommendations are actionable and specific to this codebase  
✓ Coverage gaps explicitly stated  
