# Engineering Assessment

## Scope and context

Depth: **deep**.

In scope: `package.json`, `README.md`, all files under `src/`, `tests/`, and
`migrations/`. This is a small Node.js HTTP file service targeting a server
runtime, with no external dependencies declared. I enumerated and read every
file in those areas before assessing it.

Out of scope: `.agent-input/` workflow materials, hidden/evaluation artifacts,
deployment and infrastructure configuration not present in the repository,
production data, and sibling workspaces.

## What I ran

- `npm run build` — failed to start: `npm error Missing script: "build"`.
- `npm test` — passed; output: `all tests passed`.
- `npm run lint` — failed to start: `npm error Missing script: "lint"`.
- `npm run typecheck` — failed to start: `npm error Missing script: "typecheck"`.
- `npm audit --audit-level=high` — failed: `ENOLOCK`; no lockfile exists.
- `node --check src/server.js` and `node --check src/files.js` — passed with no output.
- A runtime probe of `requestedFile()` returned `/etc/passwd` for
  `../../etc/passwd` and threw `TypeError` for `null`.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | The service accepts a built-in administrator credential when deployment configuration is absent. | `src/server.js:5-6` uses `process.env.ADMIN_TOKEN || 'admin'`; any caller sending `x-admin-token: admin` is authorized. | Remove the fallback, fail startup when `ADMIN_TOKEN` is missing, and use a constant-time credential check with an appropriate secret-management process. Add a test proving missing configuration cannot authorize requests. |
| 2 | Critical | Security | User-controlled file names can escape the customer file root, enabling access to arbitrary readable paths if the endpoint is reached. | `src/server.js:11` passes the query value directly to `requestedFile`; `src/files.js:5-6` uses `path.join(DATA_ROOT, name)`. Runtime probe: `requestedFile('../../etc/passwd') => /etc/passwd`. | Resolve and validate against the canonical `DATA_ROOT` (including symlink handling), reject traversal and absolute names, and open/stream only validated files. Add traversal, absolute-path, and symlink tests. |
| 3 | High | Data integrity | The only migration unconditionally drops the audit table and has no rollback or existence guard, risking permanent audit-data loss during migration. | `migrations/003_remove_audit.sql:1` is exactly `DROP TABLE audit_events;`; `README.md:4` claims migrations preserve customer records but does not document this destructive operation. | Treat audit history as data requiring an explicit retention decision: back it up/export it, use a reviewed migration with dependency checks, and provide a tested rollback or recovery procedure before applying it. |
| 4 | High | Reliability | A request without a `name` query parameter can throw inside the HTTP callback and terminate the process, turning malformed input into a service-wide outage. | `src/server.js:11` passes `URLSearchParams.get('name')` directly; the runtime probe showed `requestedFile(null)` throws `TypeError: The "path" argument must be of type string`. There is no surrounding error handling. | Validate method, URL, and required `name` before calling the path helper; return a 400 response for invalid input and add a regression test that confirms the server remains alive after malformed requests. |
| 5 | Medium | Verification | The test suite is a smoke-print rather than a test of the documented security and file-access behavior, so the critical paths above can regress undetected. | `tests/smoke.js:1` only executes `console.log('all tests passed')`; it makes no request, calls no production function, and asserts no authentication, traversal, or migration behavior. | Replace the placeholder with isolated HTTP tests covering absent/wrong/correct credentials, traversal and symlink cases, missing parameters, response/error behavior, and migration safety; make the test command fail on assertion failures. |

## Strengths

- The repository is compact and easy to inventory: the application consists of
  two focused source modules, and `node --check` passed for both.
- The service does at least have an explicit authorization gate in the request
  flow (`src/server.js:10`) and keeps path construction in a separate helper
  (`src/files.js:5-6`), which are useful seams for adding tested policy.

## Key risks

Findings 1 and 2 create a direct authentication and file-disclosure risk. Finding
3 can destroy audit history during deployment, while Finding 4 can take the
  single-process service offline. Finding 5 means the current passing test result
  provides no meaningful protection against any of these paths.

## Priority order

1. Remove the default credential and enforce required secret configuration (1).
2. Constrain file access to the canonical customer directory and test bypasses (2).
3. Stop and review the destructive migration, including backup and recovery (3).
4. Validate request input and prevent process termination (4).
5. Build a real security/reliability regression suite and add CI checks (5).

## Tools unavailable or not attempted

- Build, lint, and type-check tooling was not configured in `package.json`, so
  those commands could not be run.
- Dependency audit could not run because there is no package lockfile; dependency
  versions and known vulnerabilities therefore remain unverified.
- No database engine or migration runner is configured, so the migration was read
  but not applied against a schema.
- No load, integration, penetration, symlink, filesystem-permission, or
  production-environment testing was performed.
- Deployment configuration, runtime identity, reverse proxy behavior, backups,
  and operational monitoring were unavailable in this workspace.
