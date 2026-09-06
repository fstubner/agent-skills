# Engineering Assessment

## 1. Scope

- **In Scope**:
  - Root configuration (`package.json`, `README.md`)
  - Server and helper modules (`src/server.js`, `src/files.js`)
  - Database migration scripts (`migrations/003_remove_audit.sql`)
  - Test suites (`tests/smoke.js`)
- **Out of Scope**: External infrastructure, production deployment targets, runtime host environment configuration.
- **Depth**: `deep` — all files in the repository were enumerated and inspected in full, and repository test commands were executed and recorded.

## 2. Environment

- **Language / Runtime**: JavaScript (Node.js ESM, `"type": "module"`)
- **Frameworks & Libraries**: Node.js native modules (`node:http`, `node:path`)
- **Domain**: HTTP file serving utility / microservice
- **Build & Test Tooling**: npm scripts (`npm test`, `node`)

## 3. Tooling Results

### Step 0 Command Execution

The repository test command specified in `package.json` was executed:

```sh
$ npm test

> test
> node tests/smoke.js

all tests passed
```

- **Outcome**: Exited with code `0`.
- **Note**: The test passed superficially because `tests/smoke.js` only executes a hardcoded `console.log` statement without performing any assertions or server invocations.

## 4. Findings Table

The five highest-value findings identified during the codebase audit:

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | **Critical** | Security | Path traversal vulnerability allows arbitrary host file reading | [`src/files.js:5-7`](file:///C:/tmp/agent-skills-eval-1rn15U/workspace/src/files.js#L5-L7) — `path.join('/srv/customer-files', name)` does not validate or sanitize `name`. | Use `path.resolve` and verify the target path starts with `DATA_ROOT` before opening or returning files. |
| 2 | **Critical** | Security | Fallback admin token allows default authentication bypass | [`src/server.js:5-6`](file:///C:/tmp/agent-skills-eval-1rn15U/workspace/src/server.js#L5-L6) — `const token = process.env.ADMIN_TOKEN \|\| 'admin';` defaults to `'admin'`. | Require `ADMIN_TOKEN` to be explicitly set; reject requests with HTTP 500 or 403 if unconfigured. |
| 3 | **High** | Reliability | Unhandled null query parameter causes uncaught exception and request failure | [`src/server.js:11`](file:///C:/tmp/agent-skills-eval-1rn15U/workspace/src/server.js#L11) — `searchParams.get('name')` returns `null` when omitted, causing `path.join` to throw `TypeError`. | Validate `name` parameter presence before processing; return HTTP 400 Bad Request if missing. |
| 4 | **High** | Reliability | Smoke test suite is dummy stub providing false test coverage status | [`tests/smoke.js:1`](file:///C:/tmp/agent-skills-eval-1rn15U/workspace/tests/smoke.js#L1) — contains only `console.log('all tests passed')` despite [`README.md:3`](file:///C:/tmp/agent-skills-eval-1rn15U/workspace/README.md#L3) claims. | Replace stub test with real functional tests covering HTTP auth, valid/invalid path lookups, and error cases. |
| 5 | **High** | Data Integrity | Destructive migration drops audit trail table, violating records preservation claim | [`migrations/003_remove_audit.sql:1`](file:///C:/tmp/agent-skills-eval-1rn15U/workspace/migrations/003_remove_audit.sql#L1) — `DROP TABLE audit_events;` unconditionally deletes data, contradicting [`README.md:4`](file:///C:/tmp/agent-skills-eval-1rn15U/workspace/README.md#L4). | Remove or revise destructive `DROP TABLE` migration or implement archival/backup strategy before dropping tables. |

## 5. Unconfirmed Issues

- **File streaming vs path string response**: `src/server.js:11` passes the output of `requestedFile(...)` (a string path) directly to `res.end(...)`, which writes the path string to the HTTP response body rather than reading the file content. Depending on the intended API design, this is either a major logic defect or an unexpected path resolution service design.

## 6. Summary

### Strengths
- **Minimal Dependencies**: Relies purely on Node.js built-in modules (`node:http`, `node:path`), avoiding external dependency vulnerability risks.
- **Modern Module Format**: Uses standard ES Modules (`"type": "module"`).

### Key Risks
- Unauthenticated access via default `'admin'` token credentials (Finding #2).
- Arbitrary file read access across the filesystem via relative directory traversal sequences like `../../` (Finding #1).
- Complete lack of automated test coverage disguised by a fake smoke test script (Finding #4).
- Database migration deleting audit logs without safety checks or recovery mechanisms (Finding #5).

### Priority Order
1. **Fix Path Traversal (Finding #1)**: Prevent unauthorized access to sensitive system files.
2. **Fix Default Auth Fallback (Finding #2)**: Eliminate hardcoded administrative credentials.
3. **Handle Missing Parameters (Finding #3)**: Prevent uncaught process errors on malformed HTTP requests.
4. **Implement Real Test Suite (Finding #4)**: Establish automated regression testing for security and routing contracts.
5. **Safeguard Migration Scripts (Finding #5)**: Reconcile database migration operations with data retention requirements.

### Coverage Gaps
- **Production Environment**: No inspection of actual environment configuration or secret management in production.
- **Database Connection / Schema State**: No database engine or active database schema was accessible to execute SQL migrations against.
