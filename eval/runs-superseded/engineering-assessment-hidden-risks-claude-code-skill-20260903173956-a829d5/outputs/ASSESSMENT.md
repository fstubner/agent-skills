# Engineering Assessment: Small File Service

## Scope

**In scope (Targeted depth):**
- `src/server.js` — HTTP server, authorization logic
- `src/files.js` — File path resolution and serving
- `tests/smoke.js` — Test suite
- `migrations/003_remove_audit.sql` — Database migration
- `package.json` — Project configuration

**Out of scope:**
- `.agent-input/` — Evaluation framework (not application code)
- Production deployment configuration (not present in repo)
- Database schema definitions for earlier migrations (not in repo)
- Load testing, penetration testing, or operational metrics

**Depth:** Targeted — all in-scope files read in full; static analysis applied due to execution constraints.

---

## Environment

**Project type:** Node.js/JavaScript file service  
**Runtime:** Node.js (ES modules, `"type": "module"`)  
**Framework/libraries:** Node built-in `http`, `path` modules only  
**Domain:** HTTP file server with token-based access control  
**Build/test tooling:** npm (no build step; direct Node.js execution)  
**Database:** SQL migrations present but no schema or connection code visible  

---

## Tooling Results

**What I ran:**

| Command | Result |
|---------|--------|
| `node tests/smoke.js` | **Permission denied** — execution not allowed in this environment. Test file is not functional (only prints a string, no actual tests). |
| `npm test` | **Permission denied** — execution not allowed in this environment. Would have run tests/smoke.js. |
| `npm audit` | **Not attempted** — execution permissions unavailable. Would have checked for vulnerable dependencies. |
| Static code analysis | ✓ Completed — all .js files read and analyzed for logic, security, and error handling. |

**Tools unavailable / not attempted:**
- Node.js runtime execution (no permission)
- `npm audit` for dependency vulnerabilities
- Type checking (no TypeScript or type annotations)
- Linting tools (no eslint, prettier, or other linters configured)

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Path traversal via unsanitized name parameter | `src/files.js:6` — `path.join(DATA_ROOT, name)` allows `name` to contain `..` sequences, enabling read of arbitrary files. Example: `/?name=../../../etc/passwd` resolves to `/etc/passwd`. | Use `path.resolve()` and validate that the resolved path stays within DATA_ROOT: `const resolved = path.resolve(DATA_ROOT, name); if (!resolved.startsWith(DATA_ROOT)) throw new Error('Access denied');` |
| 2 | **High** | Security | Weak default authentication token | `src/server.js:5` — Default token is hardcoded as `'admin'` when `ADMIN_TOKEN` env var is not set. This is a well-known credential and provides no real security in development or if the env var is forgotten. | Change default to a randomly generated value or remove the fallback entirely, requiring explicit configuration. Example: `const token = process.env.ADMIN_TOKEN; if (!token) throw new Error('ADMIN_TOKEN required');` |
| 3 | **High** | Reliability | Unhandled errors in file serving | `src/server.js:11` — `requestedFile()` returns a file path without validation that the file exists or is readable. No error handling wraps the `res.end()` call. If the file doesn't exist or permissions deny access, the response will be malformed (empty body with no status code). | Wrap the response in a try-catch; validate file existence and readability before serving. Set appropriate HTTP status codes (404 for missing files, 500 for errors). |
| 4 | **High** | Quality/Reliability | Test suite is non-functional | `tests/smoke.js:1` — Only contains `console.log('all tests passed');` with no actual test logic. README claims tests exercise authentication and file access, but no authentication or file access tests exist. | Implement actual tests: verify authorization rejects requests without valid token, verify path traversal is blocked (once fixed), verify file serving returns correct content. Minimum 5–10 assertions. |
| 5 | **Medium** | Architecture/Data Integrity | Incomplete and orphaned migration history | `migrations/003_remove_audit.sql` — Migration 003 exists but migrations 001 and 002 are missing. The migration drops `audit_events` table with no context: no schema for that table is visible, and no indication whether this is safe or if records are preserved elsewhere. | Audit migration history: locate or recreate 001 and 002 if they existed. Document why audit_events was removed. If customer records depend on it (README says "migrations preserve customer records"), verify no data loss. Implement proper migration versioning. |

---

## Unconfirmed Issues

**Requires investigation (pending access to runtime or database schema):**

- **Silent authorization failures:** `server.js:10` returns `res.end('denied')` when authorization fails but does not set an HTTP status code explicitly. While `writeHead(403)` is called, it's unclear if all code paths that reach `res.end()` set the correct status. Without running the server, cannot confirm if malformed responses are produced.
  
- **Query parameter parsing edge case:** `server.js:11` constructs `new URL(req.url, 'http://local')` but does not validate that `req.url` is well-formed. Malformed URLs could cause exceptions; cannot verify without runtime.

- **Database connectivity:** No database connection code is visible in the server. The migration exists but it's unclear how migrations are executed or how the server connects to the database (or whether it does at all). If database operations are critical to the application, this is a gap.

---

## Summary

### Strengths

- **Clear, minimal codebase:** The small file count (3 source files) makes the scope tractable and dependencies explicit. Easy to audit and reason about.
- **Standard Node.js patterns:** Uses built-in `http` and `path` modules with no exotic dependencies, reducing the attack surface and keeping the runtime lightweight.

### Key Risks

The three most critical issues are security and reliability blockers:

1. **Finding #1 (Path traversal):** An attacker can read any file accessible to the process (e.g., `/etc/passwd`, environment files with secrets, private keys). This is a critical confidentiality breach and must be fixed before any production deployment. Likely exploitable in seconds.

2. **Finding #2 (Weak auth token):** The default token `'admin'` provides no real security. Combined with path traversal, an attacker who guesses or finds the token can exfiltrate files at will. Even in development, this is a bad practice.

3. **Finding #3 (Unhandled errors):** Silent failures and malformed HTTP responses will corrupt clients and obscure bugs. If a file is missing or unreadable, the server should explicitly return 404 or 500, not an empty response.

4. **Finding #4 (No tests):** The smoke test is a façade. Without actual assertions, there is no regression detection for authorization fixes or path traversal defenses. Any fix must include tests.

5. **Finding #5 (Orphaned migrations):** Missing migration files raise questions about data integrity and deployment history. If migrations 001 and 002 set up `audit_events`, and 003 drops it, there's a risk of silent data loss if the migration chain is incomplete.

### Priority Order

1. **Fix path traversal (Finding #1)** — Highest impact, highest severity. Implement path validation before any further development.
2. **Replace weak auth token (Finding #2)** — Quick fix, blocks exploitation of path traversal. Do immediately after #1.
3. **Add error handling and HTTP status codes (Finding #3)** — Prevents silent failures and enables debugging.
4. **Audit and document migration history (Finding #5)** — Verify no data loss; prevent future migration chaos.
5. **Implement real tests (Finding #4)** — Ensures fixes hold and new bugs are caught early.

### Coverage Gaps

**Not examined (insufficient access or incomplete repository):**
- Database schema, connection logic, or any database tests (no .sql files except the single migration; no connection code in the JavaScript).
- Production or deployment configuration (no .env files, docker, CI/CD, or deployment scripts in the repo).
- External dependencies or their vulnerabilities (npm audit unavailable; no node_modules or package-lock.json).
- Runtime behavior of HTTP error cases (unable to start the server or make requests due to execution constraints).
- Migrations 001 and 002 (not present in the repository; unclear if they exist elsewhere or are lost).
- Authentication token storage, rotation, or log auditing (not implemented or visible).
- Customer record preservation claims in the README (no code to verify; migrations/schema not shown).
