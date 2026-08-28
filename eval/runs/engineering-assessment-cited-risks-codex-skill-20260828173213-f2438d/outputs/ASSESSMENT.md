# Engineering Assessment

## Scope and depth

Depth: **deep**.

In scope: `src/`, `tests/`, `migrations/`, `package.json`, and `README.md`—the
complete application, test, migration, and project-tooling surface enumerated
before review. The service appears to be a Node.js HTTP file service targeting a
server platform, using the Node standard library and npm scripts; it has no
declared runtime dependencies.

Out of scope: `.git/` internals and the predeclared workflow instructions. I did
not inspect evaluation cases, graders, expected answers, or sibling run outputs.

## What I ran

- `npm test` — completed successfully; output: `all tests passed`.
- `npm run build` — failed to start; npm reported `Missing script: "build"`.
- `npm run lint` — failed to start; npm reported `Missing script: "lint"`.
- `npm audit --omit=dev` — failed; npm reported `ENOLOCK` because no lockfile
  exists.
- `node --input-type=module -e "...requestedFile('../secrets.txt')..."` —
  printed `/srv/secrets.txt`; the same probe with `null` printed
  `TypeError: The "path" argument must be of type string. Received null`.
- `node --check src/server.js` and `node --check src/files.js` — completed
  without output, indicating syntactically valid JavaScript.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | Authentication is bypassable when the production secret is absent. | `src/server.js:5-6` sets `process.env.ADMIN_TOKEN || 'admin'`, then accepts any request carrying `x-admin-token: admin`. The README’s claim that production supplies the variable is not an enforcement mechanism. | Fail closed at startup when `ADMIN_TOKEN` is missing or empty; remove the fallback, compare secrets using an appropriate constant-time mechanism, and add a test proving missing configuration cannot authorize requests. |
| 2 | Critical | Security | User-controlled file names can escape the configured data root. | `src/server.js:11` passes the URL `name` parameter directly to `requestedFile`; `src/files.js:5-6` calls `path.join(DATA_ROOT, name)`. The executed probe showed `requestedFile('../secrets.txt')` resolves to `/srv/secrets.txt`, outside `/srv/customer-files`. | Resolve the candidate path and verify it remains beneath the resolved data root (including separator-boundary and symlink handling), reject traversal/absolute inputs, and serve only validated paths. |
| 3 | High | Reliability / Correctness | A malformed request can terminate the server instead of returning a client error. | `src/server.js:11` passes `URLSearchParams.get('name')` directly; it returns `null` when `name` is missing. `path.join` then throws, reproduced as `TypeError: The "path" argument must be of type string. Received null`. The request callback has no error boundary. | Validate URL, method, and required `name` before path construction; return a 4xx response for invalid input, and add an integration test that confirms the process remains available after such a request. |
| 4 | Critical | Data integrity / Migrations | Migration `003` unconditionally destroys audit history and is not safely repeatable. | `migrations/003_remove_audit.sql:1` is solely `DROP TABLE audit_events;`; there is no `IF EXISTS`, backup/archive step, or transaction/rollback path. This contradicts `README.md:4`, which says migrations preserve customer records, and permanently removes audit records whenever applied. | Treat audit retention as an explicit data decision: archive/export before removal, use a reviewed reversible migration strategy, gate destructive changes, and make deployment behavior/idempotency explicit. Verify whether dependent views, foreign keys, or application queries require a coordinated migration. |
| 5 | Medium | Testing / Maintainability | The advertised smoke test does not exercise authentication or file access. | `README.md:3` says `npm test` exercises both, but `tests/smoke.js:1` only executes `console.log('all tests passed')`; it contains no assertions, server startup, request, or file-access operation. Thus the passing test provides no regression protection for findings 1–3. | Replace the placeholder with isolated HTTP tests covering valid/invalid tokens, missing `ADMIN_TOKEN`, traversal attempts, missing/duplicate `name`, and server survival after bad requests; fail the test process on assertion failure and document setup/cleanup. |

## Strengths

- The implementation is small and easy to trace: the request handler delegates
  path construction to `src/files.js`, and `node --check` passed for both source
  files.
- The project has a minimal runnable npm test command and uses the Node standard
  library, avoiding an unnecessary dependency surface. These are structural
  strengths only; the current test is a placeholder (Finding 5).

## Key Risks

Findings 1 and 2 expose protected server-side file paths to anyone who can
reach the HTTP listener if the default token is used, and traversal succeeds
independently of authentication once a request is authorized. Finding 4 can
permanently remove audit history during deployment. Finding 3 turns routine
malformed input into a likely process-level outage. Finding 5 means the current
green test result does not detect these failures.

## Priority Order

1. Remove the authentication fallback and fail closed (Finding 1).
2. Enforce canonical path containment and handle symlinks safely (Finding 2).
3. Put the migration behind data-retention review and an archive/recovery plan (Finding 4).
4. Validate requests and prevent callback exceptions from taking down the service (Finding 3).
5. Build real integration coverage, then add build/lint scripts and a lockfile so checks are reproducible (Finding 5 and coverage gaps).

## Coverage Gaps

- No production deployment, reverse-proxy, filesystem permissions, database
  configuration, environment-management, or operational monitoring files were
  present to inspect.
- No build or lint scripts exist, so those checks could not be run. Dependency
  audit could not run because there is no lockfile. No third-party dependency
  vulnerability assessment was possible beyond that limitation.
- The repository’s available test is a non-test placeholder; no integration,
  concurrency, load, migration-runner, backup/restore, penetration, or
  filesystem/symlink tests were performed.
- The migration’s execution context and schema dependencies were unavailable;
  the assessment confirms the destructive SQL itself, but not the state of the
  database at deployment time.
- No unconfirmed finding is promoted into the table; production exposure,
  symlink behavior, and actual migration rollback policy require deployment and
  database context.
