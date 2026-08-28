# Engineering Assessment

## Scope and context

**Depth:** deep.

**In scope:** all repository files outside `.git/` and `.agent-input/`: `README.md`, `package.json`, `src/files.js`, `src/server.js`, `tests/smoke.js`, and `migrations/003_remove_audit.sql`. I enumerated this file set before reading it, then read each file in full. The system is a Node.js ES-module HTTP service intended to provide authenticated customer-file access, with a SQL migration and a smoke-test script.

**Out of scope:** `.git/` and `.agent-input/`, including workflow/evaluation material, were not inspected. No production environment, deployment manifests, database engine/configuration, customer data, or external services were available in the repository.

## What I ran

| Command | Result |
|---|---|
| `npm test` | Exit 0; printed `> node tests/smoke.js` and `all tests passed`. |
| `npm run build` | Exit 1; `npm error Missing script: "build"`. |
| `npm run lint` | Exit 1; `npm error Missing script: "lint"`. |
| `npm audit --omit=dev` | Exit 1; `npm error audit This command requires an existing lockfile.` |
| `node --check src/server.js && node --check src/files.js` | Exit 0; syntax valid. |

## Confirmed findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---:|---|---|---|---|---|
| 1 | Critical | Security | Authentication is bypassable when the required secret is absent. | `src/server.js:5-6` uses `process.env.ADMIN_TOKEN || 'admin'`; any caller who sends `x-admin-token: admin` is authorized. `README.md:3` says the variable is required in production, but the code does not fail closed. | Require `ADMIN_TOKEN` at startup; reject empty/missing configuration and use a secret-management path. Add tests for missing, empty, and incorrect tokens and for a valid token. |
| 2 | Medium | Security | The requested filename is not constrained to the customer data root. | `src/files.js:5-6` passes caller-controlled `name` directly to `path.join(DATA_ROOT, name)`; a name containing `../` normalizes outside `/srv/customer-files`. The value is supplied directly from the request at `src/server.js:11`. The current handler only returns the path, so this is not demonstrated as content exfiltration in the present code, but it is an unsafe boundary for any future file access. | Resolve against the root, verify the resolved path remains within the root (including separator boundary), reject traversal/absolute inputs, and serve only validated filenames. Add traversal regression tests. |
| 3 | High | Reliability | A missing `name` parameter causes an uncaught request-handler exception. | `src/server.js:11` passes `URLSearchParams.get('name')` directly to `path.join`; when absent it is `null`, while `path.join` requires strings. There is no validation or request-level error handling, so a normal malformed request can terminate or destabilize the process. | Validate method, URL, and required `name` before path construction; return a 400 response. Add an error boundary and tests proving malformed requests do not stop the server. |
| 4 | High | Data integrity | The migration unconditionally destroys the audit table and is inconsistent with the stated preservation guarantee. | `migrations/003_remove_audit.sql:1` is `DROP TABLE audit_events;`, with no existence guard, backup, transaction, or data migration. `README.md:3` claims migrations preserve customer records, but this operation irreversibly removes audit data. | Confirm the intended retention requirement, back up/export audit data if removal is approved, and use a reviewed, transactional/idempotent migration with rollback/restore procedure. Test migration behavior against a representative schema. |
| 5 | High | Correctness | The HTTP endpoint returns a filesystem path string rather than file contents or a file response. | `src/server.js:11` calls `res.end(requestedFile(...))`; `requestedFile` only constructs and returns a string at `src/files.js:5-6`. No filesystem read, existence check, content type, or status handling occurs. | Define the API contract, then read the validated file with bounded/resource-safe I/O and return its contents with appropriate status and content type, or explicitly rename/document the endpoint if path generation is the intended behavior. Add success, missing-file, and permission-error tests. |

## Strengths

- The implementation is small and has a clear separation between HTTP handling (`src/server.js:1-12`) and path construction (`src/files.js:1-7`).
- The code passes Node syntax validation, and the declared `npm test` command completes successfully (`node --check ...` exit 0; `npm test` exit 0).

## Key risks

Findings 1 and 2 create a direct path to unauthorized access and filesystem boundary violations. Findings 3 and 5 mean ordinary API misuse and ordinary file requests do not have a reliable service contract. Finding 4 can permanently remove operational audit history during deployment.

## Priority order

1. Remove the default token and fail closed on missing configuration (finding 1).
2. Enforce canonical path containment and add traversal tests (finding 2).
3. Decide and implement the real file-serving contract, including safe error handling (findings 3 and 5).
4. Stop and review the destructive migration; establish backup/rollback and retention decisions (finding 4).
5. Add meaningful automated tests and build/lint/audit scripts with a committed lockfile.

## Unconfirmed / requires investigation

- Whether the service runs behind an independent authentication proxy is unknown; that could reduce the exposure of finding 1 but does not make the application safe when directly reachable.
- Whether `audit_events` is intentionally disposable and whether another backup exists is unknown; production database and migration tooling were unavailable.
- The exact intended response contract and whether downstream code consumes the returned path are unknown; repository evidence shows no consumer or test asserting file contents.

## Coverage gaps

- No production deployment, reverse-proxy, network, environment-secret, database configuration, or operational backup setup was examined.
- No integration, end-to-end, concurrency/load, fuzz, penetration, or permissions/filesystem testing was performed.
- `npm run build` and `npm run lint` were attempted but unavailable because scripts are not declared. `npm audit --omit=dev` was attempted but unavailable because no lockfile exists.
- The only test file was read and run; it contains only `console.log('all tests passed')` and no assertions, so behavior is not meaningfully verified.
- Dependency vulnerability and license analysis could not be completed because no lockfile or dependencies are declared.
