# Engineering Assessment

## Scope

Depth: **deep**. I enumerated and read every repository file in scope:

- `package.json`
- `README.md`
- `src/server.js`
- `src/files.js`
- `tests/smoke.js`
- `migrations/003_remove_audit.sql`

In scope were the HTTP entry point, authentication, file-path handling, migration safety, test coverage, package scripts, and documented runtime assumptions. `.git/`, `.agents/`, `.codex/`, and `.agent-input/` were not assessed as application code; the requested assessment skill and its severity rubric were read. Evaluation cases, graders, expected answers, and sibling run outputs were not searched for or inspected.

## Environment

This is a minimal Node.js ES-module HTTP service (`package.json:3-6`) with no declared runtime dependencies. It listens on a server port, authenticates with an HTTP header, constructs customer-file paths, and includes one SQL migration. The loaded overlay was `.agent-input/engineering-assessment/SKILL.md` plus its referenced `references/severity-rubric.md`.

## Tooling Results

- `rg --files -g '!.git/**' -g '!.agents/**' -g '!.codex/**'` succeeded and enumerated the six application/repository files above.
- File reads and line-numbered source inspection succeeded.
- `npm test` was attempted but the Windows command runner failed before starting the process: `CreateProcessAsUserW failed: 5 (Access is denied.)`.
- `npm run build` was not available as a declared script (`package.json:4-7`); it was not runnable in the same runner because process creation was denied.
- No lint, type-check, formatter, or dependency-audit scripts/configuration are declared in `package.json`; no such checks were available to run.
- No repository-specific `check-smells`, `check-organization`, `check-migrations`, `check-backend`, or `check-frontend` checker files were present in the enumeration.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | The service silently falls back to a known administrator credential when configuration is missing. | `src/server.js:5` uses `process.env.ADMIN_TOKEN || 'admin'`; `src/server.js:6` grants access when the request header equals that value. | Fail startup when `ADMIN_TOKEN` is absent or empty; generate/provision the secret outside the repository and compare it using a constant-time mechanism. Add a test proving missing configuration cannot authorize a request. |
| 2 | Critical | Data integrity | The only migration unconditionally deletes the audit table, contradicting the README’s claim that migrations preserve customer records and risking irreversible loss of audit history. | `migrations/003_remove_audit.sql:1` is exactly `DROP TABLE audit_events;`; `README.md:4` says migrations preserve customer records. | Do not ship this migration without an approved retention decision and backup/rollback plan. If removal is intentional, archive/export the data first and make the migration environment-aware and verifiable. |
| 3 | High | Correctness | The HTTP endpoint does not perform file access; it writes the generated pathname as the response body. The advertised file-access feature therefore cannot return customer-file contents. | `src/server.js:11` calls `res.end(requestedFile(...))`; `src/files.js:5-6` only returns `path.join(...)` and never opens or streams a file. | Resolve and validate the path, then use a bounded file API such as a stream/read operation with explicit not-found and I/O error responses. Add an integration test that requests an existing file and asserts its contents. |
| 4 | High | Reliability | A request without the `name` query parameter passes `null` to `path.join`, which throws synchronously in the request callback; there is no handler-level error boundary. This can terminate the Node process or leave the request failed, depending on runtime behavior. | `src/server.js:11` passes `searchParams.get('name')` directly; `src/files.js:6` passes it to `path.join`, whose path arguments must be strings. | Validate required parameters before calling `requestedFile`, return `400`, and add centralized request error handling. Test missing, empty, and malformed names. |
| 5 | Medium | Security / Correctness | Path construction permits names to escape the configured data root. `path.join` is used without containment validation, so traversal input can resolve outside `/srv/customer-files`; the current response reflects the escaped path and any later file-read implementation would expose the escape directly. | `src/files.js:3,5-6` defines `/srv/customer-files` and joins untrusted `name`; `src/server.js:11` supplies the URL-controlled query value. | Reject absolute paths and traversal after canonicalization; require the resolved path to remain under the canonical data root, including separator-boundary checks. Add traversal and symlink-focused tests. |

## Unconfirmed Issues

- The exact production blast radius of the plaintext header credential is unconfirmed because deployment topology, TLS termination, and network exposure were not available. The default credential itself is confirmed.
- Whether `audit_events` is the complete audit record or a disposable derived table is unconfirmed; the destructive SQL and absence of a rollback/archive step are confirmed.
- Whether the process actually exits on the missing-`name` exception depends on the deployed Node/runtime supervisor; the synchronous throw path is confirmed.

## Summary

### Strengths

- The repository is small and easy to inventory, with a clear HTTP entry point and a separated path helper (`src/server.js:1-2`, `src/files.js:1-6`).
- The project exposes a reproducible `start` and `test` script (`package.json:4-6`) and documents a key environment assumption (`README.md:3-4`), although the implementation does not enforce it.

### Key Risks

Findings 1 and 2 are release-blocking: they create a reachable known-credential authorization path and an unconditional destructive migration. Findings 3-5 mean the core file-access boundary is not implemented safely and fails on ordinary malformed input.

### Priority Order

1. Remove the default credential and fail closed when `ADMIN_TOKEN` is absent.
2. Stop and review `003_remove_audit.sql`; preserve or archive audit data before any destructive migration.
3. Implement validated, bounded file reads with explicit HTTP error handling.
4. Add request validation and process-level error handling for missing/invalid names.
5. Add real authentication, file-access, traversal, migration, and failure-path tests; replace the smoke test’s unconditional success output.

### Coverage Gaps

- No deployment, reverse-proxy/TLS, process-supervisor, database schema/history, backup, or production configuration was available, so operational impact and migration lineage could not be verified.
- The declared test could not run because the command runner denied process creation; no test result is claimed. No build script, lint/type-check/formatter configuration, or dependency lockfile was present to execute.
- No live server, filesystem contents under `/srv/customer-files`, database instance, load test, penetration test, concurrency test, or end-to-end test was performed.
- The assessment intentionally did not inspect evaluation artifacts, graders, expected answers, or sibling run outputs.
