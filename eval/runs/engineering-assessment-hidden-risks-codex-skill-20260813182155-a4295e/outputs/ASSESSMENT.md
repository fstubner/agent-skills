# Engineering Assessment

## Scope

**Depth:** Deep.

**In scope:** The complete application repository enumerated before review:
`README.md`, `package.json`, `migrations/003_remove_audit.sql`,
`src/files.js`, `src/server.js`, and `tests/smoke.js`. I examined the HTTP
server, authentication, file-path handling, migration, package scripts, and
tests for correctness, security, reliability, maintainability, and data
integrity.

**Out of scope:** Production infrastructure, deployment manifests, database
schema/history beyond the single migration, filesystem permissions, reverse
proxy behavior, operational metrics, and external services are not present in
the repository and were not available to inspect.

## Environment

- JavaScript ES modules on Node.js (`package.json:4-6`); HTTP server using
  Node's built-in `http` module (`src/server.js:1`).
- A small HTTP file-service domain targeting a server filesystem rooted at
  `/srv/customer-files` (`src/files.js:3`).
- One SQL migration and one npm smoke-test script; no runtime dependencies,
  lockfile, framework, lint configuration, or type-check configuration found.
- No additional workflow overlays were loaded; the engineering-assessment
  skill and its referenced severity rubric were applied.

## Tooling Results

- **Passed:** `npm test` (exit 0), but it only printed `all tests passed`.
- **Passed:** `node --check src/server.js`, `src/files.js`, and
  `tests/smoke.js` (exit 0).
- **Failed/unavailable:** `npm audit --json` (exit 1): npm reported
  `ENOLOCK`, because no lockfile exists.
- **Not applicable/not configured:** build, type-check, lint, formatter, and
  migration-specific checks; no corresponding scripts or tool configuration
  exists. No live server, database, or integration environment was supplied.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | Authentication is bypassable whenever the deployment omits `ADMIN_TOKEN`. | `src/server.js:5-6` — `process.env.ADMIN_TOKEN || 'admin'` accepts the hardcoded token `admin`; `src/server.js:9-11` gates every request only on this comparison. `README.md:3` claims production supplies the variable, but the code does not enforce that invariant. | Fail startup when `ADMIN_TOKEN` is absent or empty; use a securely provisioned secret and constant-time comparison. Add a test proving missing configuration prevents service startup and that an incorrect token is rejected. |
| 2 | Critical | Security | Authenticated requests can read outside the customer-file root through path traversal. | `src/files.js:5-6` joins untrusted query input directly: `requestedFile('../secret')` resolves to `/srv/secret`; `src/server.js:11` passes the attacker-controlled `name` parameter without validation. Combined with finding 1, the endpoint is publicly exploitable under the default token. | Resolve the candidate path and verify it remains beneath `DATA_ROOT` (including separator boundaries), reject traversal and invalid names, and serve only an allowlisted file identifier or validated relative path. Test encoded and nested `..` inputs. |
| 3 | High | Correctness | The endpoint returns a filesystem path string instead of file contents. | `src/server.js:11` calls `res.end(requestedFile(...))`; `requestedFile` returns only a string (`src/files.js:5-6`) and never reads the file. Thus a successful request exposes the resolved path but does not implement file access. | Read the validated file with explicit error handling, return its bytes/content with an appropriate content type, and map missing/permission errors to controlled HTTP responses. Add an integration test that creates a fixture and asserts the response body is its contents. |
| 4 | High | Reliability | A request without `name` can terminate the server through an uncaught `TypeError`. | `src/server.js:11` passes `URLSearchParams.get('name')`, which is `null` when absent, to `path.join` via `requestedFile` (`src/files.js:5-6`). Node's `path.join` requires strings; the callback has no try/catch or error boundary. | Validate the parameter before path construction and return `400`; add a top-level request error boundary and tests for missing, empty, malformed, and oversized parameters. |
| 5 | Medium | Testability / Maintainability | The test suite provides no behavioral coverage despite claiming to exercise authentication and file access. | `README.md:3` says `npm test` exercises authentication and file access, while `tests/smoke.js:1` only logs success and performs no assertions, imports, HTTP request, fixture setup, or migration check. `npm test` therefore passes even with the failures above. | Replace the placeholder with automated tests for configuration/authentication, traversal rejection, missing parameters, file contents, filesystem errors, and server lifecycle; make CI fail on assertion or integration failures. |

## Unconfirmed Issues

- The migration `migrations/003_remove_audit.sql:1` unconditionally drops
  `audit_events`. This is potentially destructive and may conflict with the
  README's claim that migrations preserve customer records, but the repository
  contains no schema, migration runner, rollback policy, or data model proving
  whether the table contains required customer data. Confirm its production
  usage and backup/rollback procedure before deployment.
- Filesystem permissions and whether `/srv/customer-files` is isolated from
  sensitive data could not be verified from source alone.

## Summary

### Strengths

- The implementation has a very small dependency surface: it uses Node's
  built-in HTTP and path modules (`src/server.js:1`, `src/files.js:1`) and has
  no third-party runtime packages in `package.json`.
- Source files pass Node syntax checks, and the repository includes an npm test
  entry point (`package.json:6`), providing a starting point for real coverage.

### Key Risks

Findings 1 and 2 create a direct unauthorized file-access risk. Findings 3 and
4 mean the nominal file-access path is nonfunctional and can crash on ordinary
malformed requests. Finding 5 makes these defects invisible to the current
test command.

### Priority Order

1. Remove the default credential and fail closed when authentication is not
   configured (Finding 1).
2. Constrain and validate requested paths before any filesystem operation
   (Finding 2).
3. Implement file reads with controlled error responses (Finding 3).
4. Reject missing/invalid parameters and contain request exceptions (Finding 4).
5. Replace the placeholder smoke test with behavioral and integration coverage
   (Finding 5), then add a lockfile so dependency auditing is possible.

### Coverage Gaps

- No deployment, infrastructure, database schema, migration history, CI
  configuration, or production configuration was available.
- No live HTTP integration, filesystem permission test, database migration
  execution, load test, penetration test, or concurrency test was performed.
- `npm audit` could not run because there is no lockfile; no dependency
  vulnerability result is therefore established.
- Build, lint, type-check, formatting, and migration checks were not attempted
  because no configuration or scripts for them exist.
- Git history and sibling/evaluation artifacts were not inspected.
