# Engineering Assessment

## Scope

Depth: **deep**.

In scope were every application, test, migration, configuration, and documentation file enumerated in the repository: `src/server.js`, `src/files.js`, `tests/smoke.js`, `migrations/003_remove_audit.sql`, `package.json`, and `README.md`. I examined authentication, request handling, file-path construction, migration safety, test effectiveness, and available project tooling.

No application files were changed. Evaluation cases, graders, expected answers, and sibling run outputs were not searched for or inspected.

## Environment

- JavaScript ES modules on Node.js (`package.json` sets `"type": "module"`).
- Native Node HTTP server; no runtime dependencies or framework are declared.
- A filesystem-oriented service rooted at `/srv/customer-files`.
- npm scripts provide `start` and `test`; one SQL migration drops an audit table.
- Loaded overlay: `.agent-input/engineering-assessment/SKILL.md` and its severity rubric.

## Tooling Results

- `npm test` — **passed** (`all tests passed`), but the test only logs that message and does not create a server or make an assertion.
- `npm audit --omit=dev` — **could not run**: npm reported `ENOLOCK` because no lockfile exists.
- Direct Node probe of `requestedFile()` — confirmed `../../etc/passwd` resolves to `/etc/passwd`; a `null` name throws `ERR_INVALID_ARG_TYPE`.
- `npm run` — only `start` and `test` are defined; no build, lint, type-check, format, or migration-validation scripts are available.
- Git status — repository metadata is not present at or above `/workspace`, so no change-history or tracked-file review was possible.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | Authentication silently falls back to a known default token when deployment configuration is missing. | `src/server.js:5-6` uses `process.env.ADMIN_TOKEN || 'admin'`; `src/server.js:9-12` protects the only HTTP handler with that value. Any request carrying `X-Admin-Token: admin` is authorized whenever `ADMIN_TOKEN` is unset or empty. | Fail fast during startup if `ADMIN_TOKEN` is absent or empty; remove the default, use constant-time token comparison, and add a startup/configuration test proving insecure configuration cannot run. |
| 2 | Critical | Data integrity | The migration unconditionally destroys the audit table and has no visible rollback or preservation step. | `migrations/003_remove_audit.sql:1` is exactly `DROP TABLE audit_events;`. The README states that migrations preserve customer records, but this migration deletes an audit record set without backup, rename, archival, or `IF EXISTS` guard. | Treat audit data as retained data: archive or migrate it before removal, require an explicit reviewed destructive migration, and provide a tested rollback/restore procedure. Verify the migration against a schema snapshot before deployment. |
| 3 | High | Correctness / Security | User-controlled path components can escape the configured customer-files root. | `src/files.js:5-6` calls `path.join('/srv/customer-files', name)`. A direct runtime probe produced `"../../etc/passwd" -> /etc/passwd`. The handler passes the result onward at `src/server.js:11`; any later file read or write using this helper would cross the intended tenant boundary. | Reject absolute paths and traversal segments, resolve against the root, and enforce that the normalized result remains inside the root (including separator-aware prefix checks). Add traversal and encoded-input tests before using the helper for file I/O. |
| 4 | High | Reliability | A request without the `name` query parameter throws an uncaught type error in the HTTP callback and can terminate the process. | `src/server.js:11` passes `URLSearchParams.get('name')`, which returns `null`, directly to `requestedFile`; `src/files.js:6` passes it to `path.join`. The direct probe confirmed `null -> throws ERR_INVALID_ARG_TYPE`. There is no callback `try/catch` or error response path. | Validate required query parameters before path construction and return a 400 response. Add process-level integration coverage proving malformed requests do not stop the service. |
| 5 | High | Correctness | The advertised file-access endpoint does not access or serve a file; it returns the computed filesystem path as the response body. | `README.md:3` says `npm test` exercises “file access,” while `src/server.js:11` calls `res.end(requestedFile(...))` and never opens, streams, or checks a file. A valid request therefore returns a server-internal path rather than file contents or a file error. | Define the endpoint contract and implement it consistently: if it serves files, use safe root-constrained streaming with existence/error handling and an appropriate content type; otherwise rename/document it as a path-resolution endpoint and remove the misleading file-access claim. |

## Unconfirmed Issues

- The path traversal issue is confirmed in the resolver, but the current handler does not read from the resolved path; exploitability as file disclosure or modification depends on consumers not present in this repository. It should be treated as a security boundary defect before adding such consumers.
- It is not possible to determine whether `DROP TABLE audit_events` is intentional, whether backups exist, or whether a migration runner wraps it in a transaction from the repository contents alone.

## Summary

### Strengths

- The runtime footprint is small and easy to trace: the HTTP entry point has one direct helper dependency (`src/server.js:1-2`), which reduces discovery cost.
- The service does at least centralize the customer-files root in `src/files.js:3`, providing a natural place to enforce path-boundary validation.

### Key Risks

Findings 1 and 2 expose immediate security and data-retention risk. Findings 3–5 show that the request path is not safely validated and that malformed or ordinary requests do not meet the documented file-service behavior.

### Priority Order

1. Remove the default authentication secret and fail startup on missing configuration (Finding 1).
2. Stop or remediate the destructive audit migration with a reviewed preservation/restore plan (Finding 2).
3. Enforce root-constrained path validation before any file operation (Finding 3).
4. Validate query input and contain malformed-request failures (Finding 4).
5. Implement or correct the file-serving contract, then replace the smoke test with meaningful HTTP tests (Finding 5).

### Coverage Gaps

- No production deployment manifests, environment provisioning, reverse-proxy configuration, database schema history beyond the one migration, or operational backup configuration were present.
- No dependency vulnerability audit could be completed because `package-lock.json`/another npm lockfile is absent.
- Build, lint, type-check, format, and migration-runner checks were not available as npm scripts and were not applicable to any declared tool configuration.
- No load, concurrency, penetration, filesystem-permission, backup-restore, or end-to-end production-environment testing was performed.
- No commit history or tracked-file review was possible because `/workspace` is not a Git working tree.
