# Engineering Assessment: small-file-service

## 1. Scope

- **In Scope**: All codebase files (`src/server.js`, `src/files.js`, `migrations/003_remove_audit.sql`, `tests/smoke.js`, `package.json`, `README.md`).
- **Out of Scope**: External runtime deployment environments, production infrastructure configuration.
- **Depth**: `deep` — every file in the repository was read and evaluated against security, correctness, reliability, data integrity, and testing standards. Automated test commands were executed.

---

## 2. Environment

- **Language & Runtime**: JavaScript (ES Modules, Node.js `node:http`, `node:path`).
- **Frameworks / Libraries**: Native Node.js HTTP server (no external dependencies listed in `package.json`).
- **Domain**: File resolution and HTTP access service.
- **Build & Test Tooling**: Node.js test runner via `npm test`.

---

## 3. Tooling Results

### Automated Commands Executed

| Command | Status | Output Summary |
|---|---|---|
| `npm test` | Passed (Exit Code 0) | `> test` <br> `> node tests/smoke.js` <br> `all tests passed` |

---

## 4. Findings Table

The table below lists the five highest-value findings identified during the assessment, ordered by severity.

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | **Critical** | Security | Path traversal vulnerability allows arbitrary filesystem path resolution | [src/files.js:5-7](file:///C:/tmp/agent-skills-eval-D93nWU/workspace/src/files.js#L5-L7) — `requestedFile` calls `path.join(DATA_ROOT, name)` without validating or sanitizing `name` | Sanitize input `name`, resolve absolute path with `path.resolve`, and assert that the target path starts with `DATA_ROOT + path.sep`. |
| 2 | **Critical** | Security | Hardcoded fallback for admin authorization token | [src/server.js:4-7](file:///C:/tmp/agent-skills-eval-D93nWU/workspace/src/server.js#L4-L7) — `const token = process.env.ADMIN_TOKEN \|\| 'admin';` defaults authorization to `'admin'` | Remove fallback default `'admin'`. Reject requests with 500/403 if `ADMIN_TOKEN` is not explicitly configured in `process.env`. |
| 3 | **High** | Data Integrity | Destructive migration drops audit log table breaking rolling deploys | [migrations/003_remove_audit.sql:1](file:///C:/tmp/agent-skills-eval-D93nWU/workspace/migrations/003_remove_audit.sql#L1) — `DROP TABLE audit_events;` | Replace with non-destructive, additive migrations. Follow a multi-phase deprecation strategy before dropping schema objects. |
| 4 | **High** | Reliability / Testing | Mock test suite provides false positive test coverage claims | [tests/smoke.js:1](file:///C:/tmp/agent-skills-eval-D93nWU/workspace/tests/smoke.js#L1) & [README.md:3](file:///C:/tmp/agent-skills-eval-D93nWU/workspace/README.md#L3) — `smoke.js` only logs `all tests passed` without testing HTTP server or auth | Implement real integration tests for `authorized()`, file path validation, and HTTP endpoints using `node:test` or a test runner. |
| 5 | **Medium** | Correctness | Missing input handling and returns raw path string instead of file contents | [src/server.js:11](file:///C:/tmp/agent-skills-eval-D93nWU/workspace/src/server.js#L11) — `res.end(requestedFile(new URL(...).searchParams.get('name')))` | Validate `name` parameter presence, handle missing parameters with HTTP 400, and stream or read actual file content using `fs.createReadStream`. |

---

## 5. Unconfirmed Issues

- **Unconfirmed: Process Exit / Exception Behavior on Invalid Port or System IO Errors**: `http.createServer` has no error event listener registered on the server instance. If file reading or socket errors occur, unhandled exceptions may terminate the Node process. Requires runtime load testing with stream operations to confirm crash behavior.

---

## 6. Summary

### Strengths
- **Minimal Footprint**: Uses native Node.js standard libraries (`node:http`, `node:path`) with zero external package dependencies.
- **Clear Entry Point**: Server initialization and file resolution concerns are separated into dedicated modules (`src/server.js` and `src/files.js`).

### Key Risks
- **Security Exposure**: Unsanitized path inputs (Finding 1) and hardcoded authentication fallbacks (Finding 2) allow unauthorized access to sensitive filesystem paths.
- **Deployment & Data Loss**: Destructive SQL migrations (Finding 3) risk audit log data loss and break backwards compatibility during rolling deployments.
- **Quality Blindspot**: The test suite (Finding 4) is cosmetic, creating a false signal that security and functional requirements are verified.

### Priority Order
1. **Fix Authentication Boundary (Finding 2)**: Fail closed if `process.env.ADMIN_TOKEN` is missing.
2. **Remediate Path Traversal (Finding 1)**: Enforce strict path resolution within `DATA_ROOT`.
3. **Replace Fake Test Suite (Finding 4)**: Add automated tests for auth, path traversal, and endpoint behaviors.
4. **Fix HTTP Response Logic (Finding 5)**: Stream actual file contents and handle 400/404 HTTP status codes.
5. **Update Migration Strategy (Finding 3)**: Convert `003_remove_audit.sql` into an additive, backward-compatible migration plan.

### Coverage Gaps
- **File I/O Performance & Memory Usage**: No benchmarks were conducted on large file streaming or concurrent request load.
- **Production Infrastructure**: Operating system permissions on `/srv/customer-files` and environment variable injection mechanisms were not evaluated.
