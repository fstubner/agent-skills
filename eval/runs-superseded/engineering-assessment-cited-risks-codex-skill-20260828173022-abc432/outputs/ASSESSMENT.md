# Engineering Assessment

## Scope and context

Depth: **deep**.

In scope were every repository file outside the workflow instructions: `package.json`, `README.md`, `src/files.js`, `src/server.js`, `tests/smoke.js`, and `migrations/003_remove_audit.sql`. The system is a small Node.js HTTP service targeting a server filesystem, with no runtime dependencies or declared build/lint/type-check tooling.

Out of scope: `.agent-input/` workflow/evaluation material, deployment and infrastructure configuration not present in the repository, production data, operational telemetry, and external systems.

## What I ran

- `npm run` — listed only `start` (`node src/server.js`) and `test` (`node tests/smoke.js`).
- `npm test` — passed and printed `all tests passed`.
- `npm run build` — failed: `Missing script: "build"`.
- `npm run lint` — failed: `Missing script: "lint"`.
- `npm run typecheck` — failed: `Missing script: "typecheck"`.
- `npm audit` — failed: `ENOLOCK ... requires an existing lockfile`.
- `node --check src/files.js`, `node --check src/server.js`, `node --check tests/smoke.js` — all passed.
- Direct path probes — `../../etc/passwd` resolved to `/etc/passwd`; `null` raised `TypeError`.
- Live requests against `node src/server.js` — an authorized `?name=report.pdf` request returned HTTP 200 with `/srv/customer-files/report.pdf`; an authorized request without `name` produced an empty reply and the server exited with `TypeError [ERR_INVALID_ARG_TYPE]`.
- `check-smells`, `check-organization`, `check-migrations`, `check-backend`, `check-frontend`, `eslint`, and `tsc` — unavailable/not installed or not exposed as project commands.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | The service accepts a built-in administrator credential whenever `ADMIN_TOKEN` is absent or empty. | `src/server.js:5-6` uses `process.env.ADMIN_TOKEN || 'admin'`; the live request with `x-admin-token: admin` received HTTP 200. | Fail closed at startup when `ADMIN_TOKEN` is missing, require a high-entropy secret, and compare credentials using a constant-time method. Add an authentication test proving the default token is rejected. |
| 2 | Critical | Security | User-controlled `name` can escape the customer-files root through parent-directory traversal. | `src/server.js:11` passes the query value directly to `requestedFile`; `src/files.js:6` calls `path.join(DATA_ROOT, name)`. A direct probe showed `../../etc/passwd -> /etc/passwd`. | Resolve the candidate path and verify it remains beneath the intended root (including separator boundaries), reject absolute and traversal inputs, and serve only approved regular files. Add traversal and symlink tests. |
| 3 | High | Reliability | A malformed request with no `name` crashes the entire HTTP process. | `src/server.js:11` passes `URLSearchParams.get()` directly; with no parameter it is `null`. The live request caused `TypeError [ERR_INVALID_ARG_TYPE]` at `src/files.js:6`, after which the server was no longer alive. | Validate query parameters before path handling, return a 400 response, and add a top-level request error boundary so one request cannot terminate the service. |
| 4 | High | Correctness | The advertised file-access endpoint does not access or stream a file; it returns the constructed path as the response body. | `src/server.js:11` calls `res.end(requestedFile(...))`; the live authorized request returned `/srv/customer-files/report.pdf` with HTTP 200. README line 3 describes “file access,” but no filesystem read exists. | Define the API contract, then use safe asynchronous file operations/streaming with existence, type, and permission checks; return appropriate 4xx/5xx responses and never expose server paths. |
| 5 | High | Data integrity | Migration `003` unconditionally deletes the audit table, contradicting the repository’s claim that migrations preserve customer records and offering no rollback or guard. | `migrations/003_remove_audit.sql:1` is exactly `DROP TABLE audit_events;`; `README.md:4` says “migrations preserve customer records.” | Treat audit data retention as an explicit migration decision: take a verified backup/export, use a controlled/idempotent migration strategy, document the irreversibility, and add migration testing and rollback/restore procedures before execution. |

## Strengths

- The code is small and easy to trace: the HTTP entry point delegates path construction to `src/files.js:2-6`, with no dependency-heavy runtime surface.
- All three JavaScript files pass Node syntax checks, and the declared smoke command runs successfully.
- Authentication is at least applied before the endpoint body at `src/server.js:10`, so unauthorized requests are not allowed through that branch.

## Key risks

Findings 1 and 2 create a direct compromise path if the service is reachable with its default configuration: an attacker can authenticate with a known token and select paths outside the data root. Findings 3 and 4 make normal API behavior unreliable or incorrect, while finding 5 risks irreversible operational data loss.

## Priority order

1. Remove the default credential and fail closed on missing configuration (1).
2. Enforce root containment and file-type/symlink policy (2).
3. Prevent request-level exceptions from killing the process (3).
4. Implement the intended file-serving behavior without leaking paths (4).
5. Halt and review the destructive migration, preserving/restoring audit data as required (5).

## Coverage gaps

- No deployment, reverse-proxy, TLS, process-supervisor, filesystem-permission, or production configuration was present to inspect.
- No lockfile exists, so `npm audit` could not assess resolved dependency vulnerabilities; there are no declared runtime dependencies in `package.json`.
- No real test assertions exist beyond `tests/smoke.js:1`, so authorization edge cases, file I/O, migration execution, concurrency, and recovery were not covered by the project suite.
- No load, fuzz, penetration, backup/restore, or integration testing was performed.
- The migration’s database engine, schema history, execution tooling, and whether `audit_events` contains required records were unavailable.
- The named repository checkers were not available as commands and were not run.

## Unconfirmed / Requires Investigation

- Whether the HTTP port is publicly reachable and whether an upstream proxy supplies authentication could change the practical exposure of findings 1 and 2; deployment configuration is required to confirm blast radius.
- Whether `audit_events` is disposable or already backed up could change the realized impact of finding 5; database ownership and backup evidence are required.
