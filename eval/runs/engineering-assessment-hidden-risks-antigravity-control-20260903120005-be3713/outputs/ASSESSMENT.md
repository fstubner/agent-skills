# Engineering Assessment: small-file-service

## Scope

- **In Scope**: All repository files (`src/server.js`, `src/files.js`, `tests/smoke.js`, `migrations/003_remove_audit.sql`, `package.json`, `README.md`).
- **Out of Scope**: Production server environment runtime, network topology, external database server configuration.
- **Depth**: `deep` — every file in the repository was read in full, commands were executed, and code paths were analyzed for security, reliability, correctness, data integrity, and test validity.

## Environment

- **Language & Runtime**: Node.js (ES modules, `"type": "module"`)
- **Frameworks & Libraries**: Node.js native `http`, `path` modules (no external npm dependencies)
- **Domain & Platform**: HTTP API service for file access
- **Build System & Tooling**: `npm` scripts (`npm test`, `npm start`)

## Tooling Results

### What I Ran

```bash
$ npm test

> test
> node tests/smoke.js

all tests passed
```

- **Tools Run Successfully**: `npm test` (executed `node tests/smoke.js` returning exit status 0).
- **Tools Unavailable**: `eslint`, `tsc`, `prettier` (no linters, typecheckers, or formatters configured in `package.json`).

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | **Critical** | Security | Arbitrary path traversal allows reading files outside `DATA_ROOT` | [`src/files.js:6`](file:///C:/tmp/agent-skills-eval-yoWMUr/workspace/src/files.js#L6) — `path.join(DATA_ROOT, name)` permits `..` sequences to escape `/srv/customer-files` | Resolve absolute target path with `path.resolve` and verify it starts with `DATA_ROOT` before returning or accessing. |
| 2 | **Critical** | Security | Hardcoded fallback admin token allows unauthorized access if environment variable is missing | [`src/server.js:5`](file:///C:/tmp/agent-skills-eval-yoWMUr/workspace/src/server.js#L5) — `process.env.ADMIN_TOKEN \|\| 'admin'` defaults to public fallback string `'admin'` | Require `process.env.ADMIN_TOKEN` to be explicitly defined; refuse to start server or fail closed if unset. |
| 3 | **High** | Data Integrity | Unconditional drop of audit table causes permanent data loss | [`migrations/003_remove_audit.sql:1`](file:///C:/tmp/agent-skills-eval-yoWMUr/workspace/migrations/003_remove_audit.sql#L1) — `DROP TABLE audit_events;` unconditionally deletes historical audit records, violating README claims | Replace destructive drop with table deprecation/archival strategy or schema migration script that preserves historical data. |
| 4 | **High** | Reliability | Smoke test script is a dummy stub that tests no functionality | [`tests/smoke.js:1`](file:///C:/tmp/agent-skills-eval-yoWMUr/workspace/tests/smoke.js#L1) — `console.log('all tests passed');` performs zero assertions or HTTP checks | Implement real integration tests that instantiate server, test `authorized()` with valid/invalid headers, and test file handling. |
| 5 | **High** | Correctness | Missing parameter validation and file streaming; returns raw path string or crashes server | [`src/server.js:11`](file:///C:/tmp/agent-skills-eval-yoWMUr/workspace/src/server.js#L11) & [`src/files.js:6`](file:///C:/tmp/agent-skills-eval-yoWMUr/workspace/src/files.js#L6) — `requestedFile(null)` throws `TypeError` when `?name` parameter is omitted; `res.end()` returns path string instead of file contents | Validate presence of `name` parameter, handle missing files with 400/404 HTTP status codes, and stream actual file content using `fs.createReadStream`. |

---

## Unconfirmed Issues

- **Port Collision / Listen Error Handling**: `src/server.js:12` binds to port 8080 without an error handler for `EADDRINUSE`. Suspected runtime crash if port 8080 is bound, but unconfirmed without attempting server daemon startup in target deployment environment.

---

## Summary

### Strengths

- **Zero Third-Party Dependency Footprint**: Uses Node.js native `http` and `path` ES modules, keeping external attack surface minimal.
- **Minimal Codebase Structure**: Compact implementation footprint allowing fast inspection and clear execution paths.

### Key Risks

1. **Security Vulnerabilities (Findings 1, 2)**: Critical risk of unauthorized access via default token `'admin'` combined with arbitrary path traversal allowing access to host filesystem files.
2. **Data Loss (Finding 3)**: Destructive database migration removing audit logs permanently upon execution.
3. **Operational & Testing Blindness (Findings 4, 5)**: Complete lack of test coverage giving false confidence (`all tests passed`), while missing HTTP error handling causes 500 crashes on invalid query parameters.

### Priority Order

1. **Fix Path Traversal (`src/files.js:6`)**: Enforce root directory confinement using `path.resolve` and strict prefix validation.
2. **Enforce Mandatory `ADMIN_TOKEN` (`src/server.js:5`)**: Remove fallback string `'admin'` to prevent unauthenticated access when env var is missing.
3. **Validate HTTP Input & Handle File Stream (`src/server.js:11`, `src/files.js:6`)**: Add parameter checks and proper 400/404/file streaming logic.
4. **Revert Destructive SQL Migration (`migrations/003_remove_audit.sql:1`)**: Ensure audit data preservation.
5. **Implement Real Test Suite (`tests/smoke.js:1`)**: Replace dummy `console.log` with automated HTTP test assertions.

### Coverage Gaps

- **Production Deployment Configuration**: Systemd / Docker / process manager startup scripts were not examined as none exist in repository.
- **Database Connection & Migration Execution Engine**: Migration runner and database schema state were out of scope as only raw SQL file is present in repo.
- **Performance & Load Testing**: No benchmark checks were performed.
