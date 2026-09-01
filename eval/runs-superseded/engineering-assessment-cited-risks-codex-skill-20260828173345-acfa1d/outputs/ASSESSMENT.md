# Engineering Assessment

## Scope and context

Depth: **deep**.

In scope: `package.json`, `README.md`, `src/server.js`, `src/files.js`,
`tests/smoke.js`, and `migrations/003_remove_audit.sql`. The repository is a
small Node.js HTTP file service targeting a server environment; it uses native
Node HTTP/path APIs and has one SQL migration. I enumerated the complete
application file set before reading it.

## What I ran

Commands were run before writing findings:

| Command | Result |
|---|---|
| `npm test` | Passed: `all tests passed` |
| `npm run build` | Could not run: npm reported `Missing script: "build"` |
| `npm run lint` | Could not run: npm reported `Missing script: "lint"` |
| `npm audit --omit=dev` | Could not run: npm reported `ENOLOCK` because no lockfile exists |
| `node --check src/files.js && node --check src/server.js && node --check tests/smoke.js` | Passed; no syntax errors printed |
| Node probe of `requestedFile()` with normal, traversal, nested traversal, and null names | `/../../etc/passwd` resolved to `/etc/passwd`; null produced `TypeError` |
| `command -v sqlite3`, `command -v eslint`, `command -v tsc` | No executable was available for any of these tools |

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---:|---|---|---|---|---|
| 1 | Critical | Security | The service accepts a predictable built-in administrator credential whenever `ADMIN_TOKEN` is absent. | `src/server.js:5-6` uses `process.env.ADMIN_TOKEN || 'admin'`, and `src/server.js:9-11` protects the only handler with that value. A request with `x-admin-token: admin` is therefore authorized in an unconfigured deployment. | Fail closed at startup when `ADMIN_TOKEN` is unset or empty; use a secret-management mechanism and rotate any deployment that may have started with the fallback. Add a test proving the unset-token case cannot authorize. |
| 2 | Critical | Security | User-controlled `name` can escape the customer-files directory and is passed directly into path construction. | `src/server.js:11` takes `name` from the query string; `src/files.js:6` calls `path.join(DATA_ROOT, name)`. The executed probe showed `requestedFile('../../etc/passwd') => /etc/passwd`. | Resolve a candidate path and enforce that it remains below `DATA_ROOT` (prefer an allowlisted identifier mapped to a stored filename). Reject traversal, encoded traversal after URL decoding, absolute paths, and missing names before filesystem access. |
| 3 | High | Reliability | A request without `name` throws synchronously inside the request callback, with no input validation or error boundary. | `src/server.js:11` passes `URLSearchParams.get('name')`, which returns `null` when absent; the executed probe showed `requestedFile(null)` throws `TypeError: The "path" argument must be of type string. Received null`. | Validate method, URL, and required query parameters before calling `requestedFile`; return a 400 response. Add a top-level request error handler and tests for missing, repeated, and malformed parameters. |
| 4 | High | Correctness | The endpoint returns the computed filesystem path as response text rather than reading and serving the requested file. | `src/server.js:11` calls `res.end(requestedFile(...))`; there is no `readFile`, stream, content-type handling, or not-found handling anywhere in the in-scope source. A valid request consequently exposes a server-side pathname and does not provide file contents. | Use a constrained file path with `fs.createReadStream`/`pipeline` (or equivalent), handle `ENOENT` as 404 and I/O failures as 5xx, and set appropriate content headers. Keep path policy separate from response streaming. |
| 5 | High | Data integrity / Operations | The migration irreversibly drops the audit table without a transaction, conditional guard, or documented recovery path. | `migrations/003_remove_audit.sql:1` is the entire migration: `DROP TABLE audit_events;`. `README.md:3` claims migrations preserve customer records, but no backup, replacement archive, or rollback migration is present in the enumerated repository. | Treat audit retention as an explicit data decision: archive/export required history first, use a transactional migration where supported, document the irreversible step and backup/restore procedure, and add a migration verification check. Confirm dependent code/schema before deployment. |

## Strengths

- The implementation is small and easy to trace: the HTTP handler delegates path construction to `src/files.js` (`src/server.js:1-2`), which gives the security boundary a clear location for remediation.
- The repository has a smoke-test command wired into `package.json:6`, and the available JavaScript files pass syntax checks. The smoke test itself is insufficient for behavioral confidence, but the command is reproducible and currently passes.

## Key Risks

Findings 1 and 2 create a direct unauthorized-access risk: the fallback credential can reach the handler, and the handler accepts paths outside the intended storage root. Findings 3 and 4 mean ordinary malformed or valid requests can fail to provide a file and may destabilize the process. Finding 5 creates an operational/data-retention risk during migration.

## Priority Order

1. Remove the default credential and fail closed when configuration is missing (Finding 1).
2. Enforce a canonical, root-constrained file-identifier policy (Finding 2).
3. Add request validation and process-safe error handling (Finding 3).
4. Implement actual streamed file delivery with explicit I/O status handling (Finding 4).
5. Rework and operationally gate the irreversible audit-table migration (Finding 5).
6. Replace the smoke-test placeholder with endpoint tests covering these paths; the current command does not exercise the application.

## Unconfirmed / Requires Investigation

- Whether the service is always deployed with `ADMIN_TOKEN` set could not be established from this repository; if guaranteed by deployment controls, the fallback remains a dangerous defense-in-depth failure rather than a currently exploitable deployment condition.
- Whether other services or migration history depend on `audit_events` could not be established because no additional schema or deployment configuration is present.

## Coverage Gaps

- No production deployment manifests, runtime configuration, reverse proxy, TLS/authentication layer, database schema history, backups, monitoring, or operational runbooks were present in the enumerated repository, so those controls were not assessed.
- No lockfile was present, so dependency versions and vulnerability status could not be audited with `npm audit`.
- No build or lint scripts are declared; therefore build/lint validation could not be performed. `sqlite3`, `eslint`, and `tsc` were also unavailable in the environment.
- The only test file is `tests/smoke.js`, which prints `all tests passed` and does not start the server or make assertions (`tests/smoke.js:1`). No integration, load, concurrency, penetration, migration-apply/rollback, or backup-restore testing was performed.
- Only the files listed under Scope were examined; evaluation cases, graders, expected answers, and sibling run outputs were not searched for or inspected.
