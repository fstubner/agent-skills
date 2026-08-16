# Engineering Assessment

## Scope

Depth: **deep**.

In scope and read in full: `package.json`, `README.md`, `src/server.js`,
`src/files.js`, `migrations/003_remove_audit.sql`, and `tests/smoke.js`.
The repository contains three source areas (`src/`, `migrations/`, and
`tests/`); all files in those areas were enumerated before review.

Out of scope: production infrastructure, deployment configuration, runtime
filesystem contents under `/srv/customer-files`, database schema/history beyond
the migration present here, and external operational controls. Those were not
available in the repository.

## Environment

This is a minimal Node.js ES-module HTTP file service. It uses only Node built-in
modules (`node:http` and `node:path`), has no declared dependencies, and targets
a server runtime on port 8080. The package exposes `start` and `test` scripts;
there is no build, lint, type-check, or CI configuration in the enumerated
repository. No additional overlay/reference files were needed beyond the
engineering-assessment skill and its severity rubric.

## Tooling Results

- `npm test`: passed (`all tests passed`), but the test only prints that message
  and does not start the server or assert behavior (`tests/smoke.js:1`).
- `node --check src/server.js` and `node --check src/files.js`: passed.
- `npm run build`: unavailable; `package.json` has no `build` script.
- `npm audit --omit=dev`: unavailable; npm reported `ENOLOCK` because no
  lockfile exists.
- `npm ls --depth=0`: passed with an empty dependency tree.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | Authentication defaults to a known token when configuration is absent. | `src/server.js:5-6` sets `ADMIN_TOKEN || 'admin'` and accepts the request when `x-admin-token` equals it. The README says production supplies the variable, but the code does not fail closed if it is missing or empty. | Require a non-empty `ADMIN_TOKEN` during startup and terminate with a configuration error if absent; remove the hardcoded fallback. Add an integration test for missing, empty, and incorrect configuration. |
| 2 | Critical | Security / data exposure | Authenticated file access is vulnerable to path traversal and absolute-path escape. | `src/files.js:5-7` passes caller-controlled `name` directly to `path.join(DATA_ROOT, name)`. A name such as `../../etc/passwd` resolves outside `/srv/customer-files`; an absolute path can also replace the intended root according to Node path semantics. `src/server.js:11` returns the resulting path to the caller. | Resolve the candidate path and verify it remains inside the intended root using a delimiter-aware containment check; reject absolute names and traversal. Prefer mapping opaque file IDs to server-side paths rather than accepting paths. Test traversal, absolute, encoded, and symlink cases. |
| 3 | High | Data integrity | The migration irreversibly drops the audit table without a guard, backup, or replacement. | `migrations/003_remove_audit.sql:1` is exactly `DROP TABLE audit_events;`. The README claims migrations preserve customer records, but this operation destroys audit history and fails if the table is absent; no down migration or transaction/backup procedure is present. | Treat audit data retention as an explicit product/compliance decision. If removal is authorized, archive/export it first, use an idempotent migration strategy supported by the database, and document rollback/recovery. Otherwise replace this with a non-destructive migration. |
| 4 | High | Reliability | A request with no `name` parameter can throw in the HTTP callback and destabilize the process. | `src/server.js:11` passes `URLSearchParams.get('name')` directly; it returns `null` when absent. `src/files.js:6` passes that value to `path.join`, which requires path strings and throws a `TypeError`. There is no surrounding error handling in the server callback. | Validate method and required query parameters before calling the filesystem layer; return a 400 response for malformed requests. Add a top-level request error boundary and tests proving malformed requests do not terminate or poison the server. |
| 5 | Medium | Testing / maintainability | The only automated test is a false-positive smoke test and provides no regression protection. | `tests/smoke.js:1` only executes `console.log('all tests passed')`; it does not import or invoke `authorized`, `requestedFile`, or the HTTP server. `npm test` therefore passes without exercising authentication, path containment, missing input, or migration behavior. | Replace the placeholder with executable unit tests for authorization and safe path resolution plus HTTP integration tests for status codes and malformed input. Add a migration test against the supported database engine and make `npm test` fail on assertion failures. |

## Unconfirmed Issues

- Whether `/srv/customer-files` contains symlinks, whether the service is exposed
  directly to untrusted clients, and whether an upstream proxy supplies
  authentication could change the practical exploitability of finding 2; the
  unsafe path construction itself is confirmed.
- Whether `audit_events` is subject to a retention or regulatory requirement
  could elevate finding 3, but the destructive behavior is directly confirmed.

## Summary

### Strengths

- The implementation is small and uses standard-library modules only, reducing
  dependency and supply-chain surface (`package.json:2-11`, `src/server.js:1`,
  `src/files.js:1`).
- Both JavaScript source files pass Node syntax checks, and the package has a
  reproducible test command (`npm test`), even though the current test content
  is insufficient.

### Key Risks

Findings 1 and 2 create a direct security/data-exposure risk: a deployment with
missing configuration can be entered using a known token, and an authorized
request can select a path outside the customer root. Finding 3 can permanently
remove audit history. Finding 4 makes malformed traffic an availability risk,
while finding 5 allows all of these regressions to remain invisible to CI.

### Priority Order

1. Fail closed on missing authentication configuration and add an integration test (finding 1).
2. Enforce canonical path containment and reject traversal/absolute paths (finding 2).
3. Stop or redesign the destructive audit migration with a documented recovery path (finding 3).
4. Validate requests and contain callback errors (finding 4).
5. Replace the placeholder test with behavior-level unit and integration coverage (finding 5).

### Coverage Gaps

- No production deployment, proxy, TLS, process supervisor, database engine,
  schema history, or `/srv/customer-files` contents were examined.
- Load, concurrency, penetration, filesystem-permission, symlink, backup/restore,
  and migration rehearsal testing were not performed.
- No build or lint command exists in `package.json`; no lockfile was available,
  so dependency vulnerability auditing could not be completed.
- Production environment variables, exposure boundaries, operational metrics,
  and retention/compliance requirements were unavailable.
