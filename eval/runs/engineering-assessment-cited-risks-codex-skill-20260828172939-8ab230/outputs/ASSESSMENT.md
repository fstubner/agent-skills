# Engineering Assessment

## Scope and depth

Depth: **deep**. I examined the complete application surface:

```text
README.md
migrations/003_remove_audit.sql
package.json
src/files.js
src/server.js
tests/smoke.js
```

In scope were the HTTP service, file-path handling, authentication, tests, package scripts, documentation, and the database migration. I did not inspect deployment infrastructure, runtime filesystem permissions, production data, version-control history, or external services because none are present in the repository and no production access was provided.

## What I ran

```text
npm test
> test
> node tests/smoke.js
all tests passed

npm run build
npm error Missing script: "build"

npm run lint
npm error Missing script: "lint"

npm audit --audit-level=high
npm error code ENOLOCK
npm error audit This command requires an existing lockfile.

node --check src/files.js        # exit 0
node --check src/server.js       # exit 0
```

Additional runtime probes produced:

```text
requestedFile('../../etc/passwd') -> /etc/passwd
env -u ADMIN_TOKEN; x-admin-token=admin -> true
requestedFile(null) -> TypeError [ERR_INVALID_ARG_TYPE] at src/files.js:6:15
```

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | The public file-name input can escape the customer-files root. | `src/server.js:11` passes the URL `name` directly to `src/files.js:6`; the runtime probe showed `../../etc/passwd` resolves to `/etc/passwd`. | Reject absolute paths and traversal segments, resolve against `DATA_ROOT`, then require the resolved path to remain within the root. Prefer an allowlisted file identifier and add an HTTP regression test. |
| 2 | Critical | Security | Authentication silently falls back to a known default administrator token. | `src/server.js:5-6` uses `process.env.ADMIN_TOKEN || 'admin'`; with `ADMIN_TOKEN` unset, the probe accepted `x-admin-token: admin`. | Fail startup when `ADMIN_TOKEN` is absent/empty, use a secret manager, and rotate any deployment exposed to the fallback. |
| 3 | High | Reliability / correctness | A request without `name` throws an uncaught `TypeError` in the request handler. | `src/server.js:11` passes `URLSearchParams.get('name')` directly; the probe showed `requestedFile(null)` throws at `src/files.js:6:15`. | Validate the parameter and return 400. Add tests for missing, repeated, malformed, and oversized parameters plus a request error boundary. |
| 4 | High | Data integrity | Migration `003_remove_audit.sql` irreversibly drops all audit records without a backup, transaction, or replacement. | `migrations/003_remove_audit.sql:1` is exactly `DROP TABLE audit_events;`; `README.md:4` claims migrations preserve customer records but gives no protection for audit history. | Replace this with a durable archive/replacement migration, explicit retention policy, and documented backup/rollback procedure tested before production. |
| 5 | Medium | Quality / verification | The test command reports success without exercising application behavior. | `tests/smoke.js:1` only logs `all tests passed`; `npm test` passes despite findings 1-3. There is no build or lint script, and audit cannot run without a lockfile. | Replace the placeholder with HTTP tests for auth, configuration, path containment, status codes, and malformed input. Add CI checks and commit a lockfile. |

## Strengths

- The service has a clear separation between HTTP/auth handling (`src/server.js`) and path construction (`src/files.js`), making the highest-risk fixes localized.
- Both source modules pass Node syntax checks, and the declared test command runs without external services.

## Key risks

Findings 1 and 2 are independently sufficient for unauthorized file access: one permits path escape and the other exposes a predictable credential. Findings 3 and 4 add request-crash and irreversible data-retention risk. The current test result cannot detect these problems (finding 5).

## Priority order

1. Remove the default credential and rotate any exposed administrator credential.
2. Enforce path containment and add traversal/absolute-path tests.
3. Return controlled 4xx responses for missing or invalid parameters.
4. Redesign the audit migration with backup and rollback evidence.
5. Replace placeholder tests and add reproducible lint/build/audit checks.

## Unconfirmed / requires investigation

- Path-traversal impact depends on the service account's filesystem permissions, which were unavailable.
- Whether `audit_events` contains regulated or operationally required records, and whether an external backup exists, could not be confirmed.
- Network exposure and any reverse-proxy authentication controls are not represented in the repository.

## Coverage gaps

- No deployment manifests, CI configuration, lockfile, database schema, production configuration, observability, load tests, penetration tests, or filesystem-permission checks were available/examined.
- `npm run build` and `npm run lint` were attempted but are undefined. `npm audit` was attempted but failed with `ENOLOCK` because no lockfile exists.
- The only test command was run; it is a placeholder. No integration, concurrency, load, fault-injection, or security suite was present.
