# Engineering Assessment: Small File Service

## Scope

**In Scope:**
- `src/` — all application code (server.js, files.js)
- `tests/` — test suite (smoke.js)
- `migrations/` — database schema changes (003_remove_audit.sql)
- `package.json` — dependencies and scripts

**Out of Scope:**
- `.agent-input/` — assessment guidance (not application code)
- Evaluation cases, graders, expected answers, sibling run outputs

**Depth:** Targeted — every file in scope read in full; all attempted commands documented.

---

## Environment

**Language & Runtime:** Node.js 24.14.1 (ES Modules)  
**Frameworks:** Node `http` module only  
**Domain:** HTTP file service with token-based authentication  
**Platform:** Server (listens on port 8080)  
**Build System:** npm (simple scripts, no build step)

---

## What I Ran

| Command | Result |
|---------|--------|
| `npm test` | Not executed — tool approval required; test file is a stub |
| `npm run start` | Not executed — tool approval required; server requires environment |
| `node tests/smoke.js` | Not executed — tool approval required |
| File enumeration | ✓ Completed — 8 files total |
| Code review | ✓ Completed — all source files read |

**Note:** The test file (`tests/smoke.js:1`) contains no assertions, only `console.log('all tests passed')`. Running it would not validate the application's correctness.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Path traversal vulnerability in file serving | `src/files.js:6` — `path.join(DATA_ROOT, name)` does not validate that the result stays within `DATA_ROOT`. An attacker can request `?name=../../etc/passwd` to access files outside the intended directory. | Validate the resolved path is within DATA_ROOT: `const resolved = path.resolve(path.join(DATA_ROOT, name)); if (!resolved.startsWith(DATA_ROOT + '/')) throw new Error('Access denied');` |
| 2 | **Critical** | Correctness | File serving returns path string, not file contents | `src/files.js:5-6` returns a filesystem path; `src/server.js:11` sends this string as HTTP response body instead of actual file contents. Users receive `/srv/customer-files/example.txt` instead of the file data. | Import `fs` module and read file contents: `const data = fs.readFileSync(resolved); res.end(data);` (or use streaming for large files). |
| 3 | **High** | Security | Default weak authentication token in source code | `src/server.js:5` — `const token = process.env.ADMIN_TOKEN \|\| 'admin'` defaults to hardcoded string `'admin'` if environment variable is not set. This token is exposed in the codebase and highly guessable. | Require `ADMIN_TOKEN` to be explicitly provided; fail startup if missing: `if (!process.env.ADMIN_TOKEN) throw new Error('ADMIN_TOKEN required');` |
| 4 | **High** | Reliability | No test coverage for core functionality | `tests/smoke.js:1` contains no assertions or actual tests—only a logging statement. The README claims tests exercise authentication and file access, but they do not execute. | Write actual tests covering: (1) authenticated request returns file, (2) unauthenticated request is denied (403), (3) path traversal attempts are blocked, (4) missing files are handled. |
| 5 | **Medium** | Data Integrity | Audit table removed without documented migration strategy | `migrations/003_remove_audit.sql:1` drops `audit_events` table. No indication of whether data was backed up, exported, or if this violates compliance requirements. README claims "migrations preserve customer records" but audit events appear to be intentionally deleted. | Document the reason for dropping audit_events and confirm no compliance impact (GDPR, SOX, industry regulations). Add a note to the migration or CHANGELOG explaining the business justification. |

---

## Unconfirmed Issues

**None at this time.** All findings are confirmed by direct code inspection.

---

## Summary

### Strengths

1. **Minimal attack surface** — The service is simple and dependency-free, reducing supply-chain risk and deployment complexity.
2. **Explicit authentication requirement** — Authorization checks are enforced before file access is attempted (server.js:10).

### Key Risks

- **Finding #1 + #2 together create complete service failure:** The path traversal vulnerability (#1) allows attackers to read arbitrary files on the system, and the file-serving bug (#2) means legitimate requests also fail to return actual file contents.
- **Finding #3** — Default weak token defeats the authentication layer if environment variables are not strictly managed.
- **Finding #4** — The codebase claims to be tested, but assertions are absent; no regression detection mechanism exists.
- **Finding #5** — Data removal without audit trail or documented justification suggests operational oversight.

### Priority Order

1. **Fix Finding #2 (file contents)** — Critical correctness issue; the service does not work as described. This is the fastest fix and unblocks basic functionality testing. (Effort: 5 min)
2. **Fix Finding #1 (path traversal)** — Critical security issue; must be fixed before production deployment. (Effort: 10 min)
3. **Fix Finding #3 (default token)** — High severity; eliminates a trivial bypass of authentication. (Effort: 2 min)
4. **Add Finding #4 (tests)** — High impact on reliability; necessary before deployment. (Effort: 30 min)
5. **Investigate Finding #5 (audit table)** — Confirm business intent and regulatory compliance; document or reverse if unjustified. (Effort: varies)

### Coverage Gaps

- **Runtime testing not performed** — The service was not started or exercised due to tool approval restrictions. Actual HTTP requests were not sent; edge cases in request parsing remain untested.
- **Dependency security** — No `npm audit` was run. The `package.json` declares no external dependencies, but this was not verified against a lock file or audit tool.
- **Deployment configuration** — Production environment setup, startup procedures, and operational runbooks were not examined.
- **Database integration** — The migration exists but the application code (`src/server.js`, `src/files.js`) contains no database queries or schema references. The relationship between the schema and application is unclear; this gap could hide integration issues.
- **Load testing and concurrency** — No stress testing was performed; the server's handling of concurrent requests under load is unknown.
- **Production metrics and logs** — No observability configuration was reviewed; error handling and monitoring strategies are absent from the codebase.

---

## Verified Conclusions

✓ Code structure and dependencies reviewed  
✓ All source files read and analyzed  
✓ Path traversal vulnerability confirmed by code inspection  
✓ File-serving logic confirmed as returning paths instead of contents  
✓ Authentication default token confirmed as hardcoded  
✓ Test file confirmed as non-functional stub  
✓ Migration audit table removal confirmed without business justification in codebase
