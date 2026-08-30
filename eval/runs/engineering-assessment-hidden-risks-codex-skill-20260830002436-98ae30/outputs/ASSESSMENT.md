# Engineering Assessment

## Scope and context

Depth: **deep**.

In scope: all repository application, test, migration, documentation, and package files: `src/server.js`, `src/files.js`, `tests/smoke.js`, `migrations/003_remove_audit.sql`, `package.json`, and `README.md`. The project is a minimal Node.js 22 HTTP service using native `http` and `path`, with no runtime dependencies. Its apparent target is a server-side customer-file endpoint on port 8080, with an admin-token header and a SQL migration.

Out of scope: deployment/infrastructure, the actual `/srv/customer-files` filesystem, database runtime/configuration, production traffic and metrics, and any evaluation, grader, expected-answer, or sibling-output material.

## What I ran

| Command | Result |
|---|---|
| `npm test` | Exit 0; printed `all tests passed`. |
| `npm run build` | Exit 1; `npm error Missing script: "build"`. |
| `npm run lint` | Exit 1; `npm error Missing script: "lint"`. |
| `npm audit --omit=dev` | Exit 1; `npm error audit This command requires an existing lockfile.` |
| `node --check src/server.js` | Exit 0. |
| `node --check src/files.js` | Exit 0. |
| Live `curl` probes against `node src/server.js` | No token returned HTTP 403. Header `x-admin-token: admin` returned HTTP 200 with body `/srv/customer-files/report.txt`. Omitting `name` produced an empty reply; the server log showed `TypeError [ERR_INVALID_ARG_TYPE]` at `src/files.js:6` and `src/server.js:11`, followed by process exit. |
| Node path probes for `../secrets.txt`, `/etc/passwd`, and `null` | Returned `/srv/secrets.txt`, `/srv/customer-files/etc/passwd`, and a `TypeError` respectively. |

## Confirmed findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---:|---|---|---|---|---|
| 1 | Critical | Security | Authentication silently falls back to a known token. | `src/server.js:5` uses `process.env.ADMIN_TOKEN || 'admin'`; the live probe authenticated with `x-admin-token: admin` and received HTTP 200. | Fail closed at startup when `ADMIN_TOKEN` is absent or empty; use a randomly provisioned secret and constant-time comparison, with secret rotation/operational handling. |
| 2 | Critical | Data integrity | The migration destroys the audit table without a backup, transaction, or rollback path. | `migrations/003_remove_audit.sql:1` is exactly `DROP TABLE audit_events;`; `README.md:4` claims migrations preserve customer records but provides no preservation mechanism for audit records. | Replace with a reviewed, forward-only migration that preserves or archives audit data; require an explicit backup/restore plan and migration validation before production execution. |
| 3 | High | Correctness | The advertised file-access endpoint does not access or return a file; it returns the generated path as response content. | `src/server.js:11` passes the path from `requestedFile(...)` directly to `res.end`; the live authenticated request body was `/srv/customer-files/report.txt`. `README.md:3` says the test exercises “file access.” | Define the endpoint contract and implement controlled file reads/streaming with status codes, content handling, and errors; add an integration test that verifies actual allowed-file content and missing-file behavior. |
| 4 | High | Reliability | A normal malformed request (`name` omitted) terminates the server process. | `src/server.js:11` passes `URLSearchParams.get('name')`, which is `null`, to `path.join`; live probe logged `TypeError [ERR_INVALID_ARG_TYPE]` at `src/files.js:6` and Node exited. | Validate required query parameters before calling filesystem helpers; return 400 for invalid input and add process-level logging/containment appropriate to the deployment. |
| 5 | Medium | Verification / maintainability | The test suite gives false confidence and does not exercise any application behavior. | `tests/smoke.js:1` only executes `console.log('all tests passed');`; `npm test` therefore passes without importing or starting the server. `package.json` defines no build, lint, type-check, or lockfile. | Replace the placeholder with HTTP integration tests covering auth, valid file access, invalid/missing names, and missing files; add a reproducible lockfile and CI scripts for lint/type/build checks where applicable. |

## Unconfirmed / Requires Investigation

- `src/files.js:6` allows `../` to escape the configured root (`../secrets.txt` resolved to `/srv/secrets.txt`). Because the current server only echoes the path and does not read it, a file-disclosure exploit is not confirmed in this revision. If any future caller reads this path, enforce canonical containment using `resolve` plus a root-boundary check and test symlink behavior.
- Whether `DROP TABLE audit_events` is intentionally approved cannot be established from this repository; database backups, migration ordering, and downstream consumers were unavailable.

## Strengths

- The source is small and easy to trace: the request path is only `server.js` -> `files.js`, and both files pass Node syntax checks.
- The unauthenticated path is explicitly denied with HTTP 403 (`src/server.js:10`), and the repository contains a smoke-test command that is easy to replace with real coverage.

## Key Risks

Findings 1 and 2 can directly expose the service or destroy audit data. Findings 3 and 4 mean the core request path is not production-correct or resilient to ordinary client input. Finding 5 prevents the existing test command from detecting those failures.

## Priority Order

1. Remove the default credential and fail closed (Finding 1).
2. Stop or replace the destructive audit migration under an approved data-retention plan (Finding 2).
3. Implement and test the actual file-serving contract with containment checks (Finding 3 and the unconfirmed traversal risk).
4. Validate request input and return controlled 4xx responses (Finding 4).
5. Replace the placeholder test and add reproducible project checks (Finding 5).

## Coverage Gaps

- No deployment, reverse-proxy, TLS, process supervision, secret-management, database connection, backup, or production configuration was present to inspect.
- The real customer-files directory and database were not accessed; no file-content or migration execution test was possible.
- No load, concurrency, penetration, fuzz, end-to-end, or rollback testing was performed.
- Build and lint could not be run because scripts are absent; dependency audit could not run because no lockfile exists. No type-check or formatter command was attempted because this plain JavaScript package declares neither tooling nor scripts.

