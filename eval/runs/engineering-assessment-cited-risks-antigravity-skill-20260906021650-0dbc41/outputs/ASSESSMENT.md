# Engineering Assessment

## 1. Scope

- **In scope**: All files and directories within the repository (`src/files.js`, `src/server.js`, `migrations/003_remove_audit.sql`, `tests/smoke.js`, `package.json`, `README.md`).
- **Out of scope**: Production infrastructure, runtime deployment environment `/srv/customer-files`, host system user permissions.
- **Depth**: `deep` — every file in the repository was enumerated and read in full, and repository test commands were executed and recorded.

## 2. Environment

- **Languages and runtimes**: JavaScript / Node.js (ES modules via `"type": "module"`).
- **Frameworks and libraries**: Native Node.js standard libraries (`node:http`, `node:path`).
- **Domain**: HTTP file access and storage service.
- **Platform targets**: Linux / POSIX server environments (referencing `/srv/customer-files`).
- **Build systems and tooling**: npm (`npm test`).

## 3. Tooling Results (What I ran)

### Tools run successfully

- **Command**: `npm test`
  - **Output**:
    ```
    > test
    > node tests/smoke.js

    all tests passed
    ```
  - **Result**: Command exited with status code 0.

### Tools that failed or were unavailable

- **Command**: `npx eslint .`
  - **Result**: Exited with code 1 (ESLint package not installed or configured in `package.json`).
- **TypeScript / Static Analyzers (`tsc`, `mypy`)**: Unavailable / Not configured for JS workspace.

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | Path traversal vulnerability allows unauthorized file access outside `DATA_ROOT` | [`src/files.js:5-7`](file:///C:/tmp/agent-skills-eval-XhPb2w/workspace/src/files.js#L5-L7) — `path.join('/srv/customer-files', name)` resolves relative path segments (e.g. `../../`) outside the data root directory. | Sanitize input and resolve absolute path using `path.resolve`, explicitly validating that `resolvedPath.startsWith('/srv/customer-files/')` before returning. |
| 2 | Critical | Security | Hardcoded fallback admin token allows authorization bypass when environment variable is omitted | [`src/server.js:5-6`](file:///C:/tmp/agent-skills-eval-XhPb2w/workspace/src/server.js#L5-L6) — `const token = process.env.ADMIN_TOKEN \|\| 'admin';` defaults credentials to a known string `'admin'`. | Remove hardcoded fallback string `'admin'`. Reject startup or deny all requests if `process.env.ADMIN_TOKEN` is not explicitly set in the runtime environment. |
| 3 | High | Reliability | Missing query parameter causes uncaught `TypeError` and crashes the HTTP server process | [`src/server.js:11`](file:///C:/tmp/agent-skills-eval-XhPb2w/workspace/src/server.js#L11) — `searchParams.get('name')` evaluates to `null` when `name` is absent, causing `path.join` to throw `TypeError`. | Validate the presence of the `name` query parameter before passing it to `requestedFile`, returning an HTTP 400 Bad Request error response if missing. |
| 4 | High | Data Integrity | Migration destructively drops audit log table, violating documentation guarantees | [`migrations/003_remove_audit.sql:1`](file:///C:/tmp/agent-skills-eval-XhPb2w/workspace/migrations/003_remove_audit.sql#L1) — `DROP TABLE audit_events;` permanently deletes audit records, contradicting [`README.md:3-4`](file:///C:/tmp/agent-skills-eval-XhPb2w/workspace/README.md#L3-L4). | Replace destructive table drop with soft deletion, archival, or schema modification to ensure customer audit history is preserved as documented. |
| 5 | High | Reliability | Smoke test script outputs hardcoded success message without executing any actual test assertions | [`tests/smoke.js:1`](file:///C:/tmp/agent-skills-eval-XhPb2w/workspace/tests/smoke.js#L1) — `console.log('all tests passed');` performs no assertion or request checks despite claims in [`README.md:3`](file:///C:/tmp/agent-skills-eval-XhPb2w/workspace/README.md#L3). | Implement genuine unit and integration test assertions verifying authentication headers, status codes, and file resolution logic. |

## 5. Unconfirmed Issues

- **Database Engine Compatibility**: Unable to verify which database dialect or execution tool is intended for `migrations/003_remove_audit.sql`, as no database configuration or migration runner dependency exists in `package.json`.

## 6. Summary

### Strengths

- **Minimalist Architecture**: Low overhead implementation relying purely on built-in Node.js standard modules (`node:http`, `node:path`) without third-party framework bloating.
- **Modular Function Separation**: Clear separation between HTTP request authorization logic (`src/server.js`) and file path resolution (`src/files.js`).

### Key Risks

- **Arbitrary File Access & Weak Auth**: Path traversal combined with a default hardcoded token (`'admin'`) presents immediate security exposure.
- **Process Instability & False Test Confidence**: Unhandled exceptions crash the service on missing parameters, while the test suite provides zero validation coverage despite documentation claims.

### Priority Order

1. **Fix Path Traversal** ([`src/files.js:5-7`](file:///C:/tmp/agent-skills-eval-XhPb2w/workspace/src/files.js#L5-L7)): Restrict resolved file paths strictly within `/srv/customer-files`.
2. **Eliminate Hardcoded Token Fallback** ([`src/server.js:5-6`](file:///C:/tmp/agent-skills-eval-XhPb2w/workspace/src/server.js#L5-L6)): Require explicit `ADMIN_TOKEN` environment variable.
3. **Add Input Validation & Exception Handling** ([`src/server.js:11`](file:///C:/tmp/agent-skills-eval-XhPb2w/workspace/src/server.js#L11)): Handle missing query parameters gracefully with 400 responses.
4. **Correct Migration** ([`migrations/003_remove_audit.sql:1`](file:///C:/tmp/agent-skills-eval-XhPb2w/workspace/migrations/003_remove_audit.sql#L1)): Avoid dropping `audit_events` table to honor data preservation commitments.
5. **Implement Real Test Suite** ([`tests/smoke.js:1`](file:///C:/tmp/agent-skills-eval-XhPb2w/workspace/tests/smoke.js#L1)): Add actual integration tests for endpoint behavior and authentication.

### Coverage Gaps

- **Database Execution**: No database runner or schema validator was available to test SQL migration safety empirically.
- **Production Filesystem Setup**: Permissions and existence of directory `/srv/customer-files` could not be verified on the host platform.
