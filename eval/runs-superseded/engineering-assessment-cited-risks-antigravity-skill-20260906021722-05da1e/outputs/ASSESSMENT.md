# Engineering Assessment: small-file-service

## 1. Scope

- **In Scope**: All codebase files in the repository: `src/server.js`, `src/files.js`, `migrations/003_remove_audit.sql`, `tests/smoke.js`, `package.json`, `README.md`.
- **Out of Scope**: External production filesystems (`/srv/customer-files`), host OS deployment infrastructure, live environment environment variables.
- **Depth**: `deep` — Every source file, test file, migration file, and configuration file was read in full, and all project-declared commands were executed.

---

## 2. Environment

- **Languages & Runtimes**: JavaScript (Node.js ES modules, `type: "module"`).
- **Frameworks & Libraries**: Native Node.js standard library (`node:http`, `node:path`).
- **Domain**: HTTP file serving microservice.
- **Platform Targets**: Node.js server runtime.
- **Build Systems & Tooling**: npm (`npm test`).

---

## 3. Tooling Results

### What I Ran

| Command | Status | Output / Outcome |
| :--- | :--- | :--- |
| `npm test` | Success (Exit code 0) | `> test`<br>`> node tests/smoke.js`<br><br>`all tests passed` |

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Critical** | Security | Unsanitized file path input allows directory traversal and arbitrary file reads. | [src/files.js:6](file:///C:/tmp/agent-skills-eval-azcL9G/workspace/src/files.js#L6) and [src/server.js:11](file:///C:/tmp/agent-skills-eval-azcL9G/workspace/src/server.js#L11) | Validate that `path.resolve` of the requested target stays within `DATA_ROOT` (e.g., using `resolvedPath.startsWith(DATA_ROOT)`). |
| 2 | **Critical** | Security | Hardcoded default admin token fallback allows authentication bypass when `ADMIN_TOKEN` is unset. | [src/server.js:5](file:///C:/tmp/agent-skills-eval-azcL9G/workspace/src/server.js#L5) | Require `ADMIN_TOKEN` to be set explicitly; fail fast on server startup if missing rather than defaulting to `'admin'`. |
| 3 | **High** | Data Integrity | Database migration unconditionally drops the audit table, violating documented data preservation requirements. | [migrations/003_remove_audit.sql:1](file:///C:/tmp/agent-skills-eval-azcL9G/workspace/migrations/003_remove_audit.sql#L1) and [README.md:4](file:///C:/tmp/agent-skills-eval-azcL9G/workspace/README.md#L4) | Revoke `003_remove_audit.sql` or implement a non-destructive archiving strategy before removing audit tables. |
| 4 | **Medium** | Reliability | Missing `name` query parameter passes `null` to `path.join`, throwing an unhandled `TypeError` crash. | [src/server.js:11](file:///C:/tmp/agent-skills-eval-azcL9G/workspace/src/server.js#L11) and [src/files.js:6](file:///C:/tmp/agent-skills-eval-azcL9G/workspace/src/files.js#L6) | Add explicit input validation for `req.url` parameters before processing, returning a `400 Bad Request` HTTP status if `name` is omitted. |
| 5 | **Medium** | Maintainability | Smoke test suite outputs static text without executing server logic or authentication checks. | [tests/smoke.js:1](file:///C:/tmp/agent-skills-eval-azcL9G/workspace/tests/smoke.js#L1) and [README.md:3](file:///C:/tmp/agent-skills-eval-azcL9G/workspace/README.md#L3) | Update `tests/smoke.js` to instantiate `authorized` and `requestedFile` functions or issue real test HTTP requests. |

---

## 5. Unconfirmed Issues

- **Incomplete File Streaming Response**: `src/server.js:11` passes the path string returned by `requestedFile` directly to `res.end()`, sending the file path text to the client rather than reading and streaming actual file contents from disk. Without access to `/srv/customer-files` or production API specs, it is unconfirmed whether returning path strings is an incomplete implementation or intended by design.

---

## 6. Summary

### Strengths

1. **Zero External Runtime Dependencies**: Uses standard native Node.js APIs (`node:http`, `node:path`), avoiding third-party dependency vulnerabilities and footprint overhead.
2. **Minimal and Modular Code Footprint**: Clear separation between route handling (`src/server.js`) and path resolution (`src/files.js`).

### Key Risks

- **Arbitrary File Access & Auth Bypass** (Findings #1, #2): An attacker can supply `x-admin-token: admin` and `?name=../../etc/passwd` to read sensitive host files.
- **Data Loss via Migration** (Finding #3): Destructive migration script drops `audit_events` permanently.
- **Service Instability & Test Blindspot** (Findings #4, #5): Malformed requests crash request handlers, while tests report success falsely.

### Priority Order

1. **Fix Path Traversal** (Finding #1): Enforce strict boundary checks on resolved file paths.
2. **Remove Hardcoded Secret Fallback** (Finding #2): Enforce mandatory environment variable configuration for `ADMIN_TOKEN`.
3. **Prevent Data Loss in Migrations** (Finding #3): Fix or drop `003_remove_audit.sql` to uphold data preservation guarantees.
4. **Add Input Validation** (Finding #4): Return `400 Bad Request` for missing or null parameters.
5. **Implement Real Unit/Integration Tests** (Finding #5): Exercise server authentication and file path logic in `tests/smoke.js`.

### Coverage Gaps

- Target filesystem layout and permissions at `/srv/customer-files`.
- Production process manager / systemd / Docker container configurations.
- Real database schema state prior to running `003_remove_audit.sql`.
