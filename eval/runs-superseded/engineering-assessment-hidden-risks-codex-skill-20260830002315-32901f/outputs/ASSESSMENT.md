# Engineering Assessment

## Scope and approach

Depth: **deep**. In scope were every repository file enumerated below: `README.md`, `package.json`, `src/files.js`, `src/server.js`, `tests/smoke.js`, and `migrations/003_remove_audit.sql`. I examined the Node HTTP service, authentication, file-path handling, migration, test, and package configuration end to end. `.agent-input/` workflow instructions were used but are not application scope.

The system is a small Node.js ES-module HTTP file service targeting a server filesystem at `/srv/customer-files`, with a single admin-token gate and one SQL migration. There is no declared framework, build system, lockfile, or external dependency manifest beyond `package.json`.

## What I ran

| Command | Result |
|---|---|
| `npm test` | Passed: `> test` / `> node tests/smoke.js` / `all tests passed` |
| `npm run build` | Could not run: `npm error Missing script: "build"` |
| `npm run lint` | Could not run: `npm error Missing script: "lint"` |
| `npm run typecheck` | Could not run: `npm error Missing script: "typecheck"` |
| `npm audit --audit-level=moderate` | Could not run: `npm error code ENOLOCK`; an existing lockfile is required |
| `node --check src/files.js && node --check src/server.js && node --check tests/smoke.js` | Passed with no output |
| `node --input-type=module -e "...requestedFile('../../etc/passwd')...requestedFile(null)..."` | Reproduced `/etc/passwd`; missing input throws `TypeError: The "path" argument must be of type string. Received null` |
| `git status --short` / `git diff --stat` | Could not assess repository changes: `/workspace` is not a Git repository |

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | Authentication silently falls back to a known token. | `src/server.js:5` uses `process.env.ADMIN_TOKEN || 'admin'`; `src/server.js:6` accepts that value from `x-admin-token`. If production omits or supplies an empty variable, anyone knowing `admin` passes the only gate. | Fail closed at startup when `ADMIN_TOKEN` is absent/empty; use a secret-management mechanism and constant-time comparison. Add a test for missing configuration and an unauthorized request. |
| 2 | Critical | Security | The requested filename can escape the customer-files root. | `src/files.js:6` calls `path.join(DATA_ROOT, name)` without normalization/boundary validation. Direct execution returned `/etc/passwd` for `requestedFile('../../etc/passwd')`; the reachable input is `src/server.js:11`’s URL `name` query parameter. | Resolve against the root and reject paths whose resolved value is outside the root (including absolute paths and encoded traversal); then open/serve only the validated path. Add traversal test cases. |
| 3 | High | Correctness | The endpoint does not serve the requested file; it writes the filesystem path as the response body. | `src/server.js:11` passes `requestedFile(...)` directly to `res.end()`. `requestedFile` returns a string (`src/files.js:5-6`), so clients receive a path rather than file contents, and nonexistent paths are not detected. | Use a controlled file-read/stream operation after validation, handle `ENOENT` as 404 and other I/O failures as 5xx, and test content, missing-file, and permission-error behavior. |
| 4 | High | Reliability | A request without `name` can terminate the request handler with an uncaught `TypeError`. | `src/server.js:11` passes `URLSearchParams.get('name')`, which may be `null`, to `path.join`; the direct reproduction produced `TypeError: The "path" argument must be of type string. Received null`. No handler-level error boundary is present. | Validate required query parameters before path construction and return 400; add a top-level request error strategy so malformed input cannot destabilize the service. |
| 5 | High | Data integrity | The migration irreversibly deletes the audit table without a transaction, backup/export step, or documented compatibility plan. | `migrations/003_remove_audit.sql:1` is the complete migration: `DROP TABLE audit_events;`. `README.md:4` claims migrations preserve customer records but does not document audit retention or recovery. | Establish the intended retention requirement, snapshot/export audit data before removal, use a staged/deprecated migration where possible, and document/verify restore and rollback procedures. |

## Strengths

- The service is small and easy to locate: the HTTP entry point is `src/server.js`, and path construction is isolated in `src/files.js`.
- The declared smoke command runs successfully, and all three JavaScript files pass Node syntax checks.

## Key Risks

Findings 1 and 2 permit unauthorized access and filesystem escape on the sole request path. Finding 3 means the advertised file-access behavior is functionally incorrect even for authorized requests. Findings 4 and 5 add malformed-request instability and irreversible data-loss risk.

## Priority Order

1. Remove the authentication fallback and fail closed (Finding 1).
2. Enforce a canonical path boundary before any file operation (Finding 2).
3. Implement actual validated file streaming with explicit I/O error responses (Finding 3).
4. Reject missing/invalid query parameters and contain handler errors (Finding 4).
5. Pause or redesign the destructive migration after confirming audit retention and recovery requirements (Finding 5).

## Unconfirmed / Requires Investigation

- Whether `/srv/customer-files` is isolated by container or operating-system permissions, and whether `ADMIN_TOKEN` is guaranteed by deployment tooling, was not available. Those controls could reduce—but do not remove—the application-level risks in Findings 1 and 2.
- The migration’s database engine, migration runner, backup policy, and whether `audit_events` contains required regulated records were not specified.

## Coverage Gaps

- No production deployment manifests, infrastructure permissions, runtime configuration, database schema/history, observability, or operational runbooks were present in the enumerated workspace.
- No build, lint, or type-check commands are declared; those checks therefore could not be run. Dependency audit could not run because no lockfile exists.
- The only test is `tests/smoke.js`, which prints success and does not exercise the HTTP server or any security/error path. No integration, concurrency, load, penetration, migration-upgrade, rollback, or backup-restore testing was performed.
- `/workspace` is not a Git repository, so change history and diff-based review were unavailable.
