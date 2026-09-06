# Engineering Assessment

## Scope

- **In scope**: All repository files (`src/files.js`, `src/server.js`, `migrations/003_remove_audit.sql`, `tests/smoke.js`, `package.json`, `README.md`).
- **Out of scope**: External infrastructure, host file system (`/srv/customer-files`), production environment variable configuration, and database runtime execution.
- **Depth**: `deep` — every file in the repository was read in full, and all declared project commands were executed and recorded.

## Environment

- **Language / Runtime**: JavaScript (Node.js ES modules, `"type": "module"`).
- **Frameworks & Libraries**: Node.js native `http` module, `node:path`. No external npm dependencies.
- **Domain**: HTTP file access service.
- **Platform Target**: Server-side Node.js environment.
- **Build & Test Tooling**: `npm test` (`node tests/smoke.js`).

## Tooling Results

### What I Ran

**Command**: `npm test`  
**Exit Code**: `0`  
**Output**:
```
> test
> node tests/smoke.js

all tests passed
```

- **Tools run successfully**: `npm test`
- **Tools unavailable / missing**: Linting (`eslint`), type checking (`tsc`), audit (`npm audit` - no external dependencies configured).

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | Critical | Security | Path traversal vulnerability allows arbitrary file read | [`src/files.js:6`](file:///C:/tmp/agent-skills-eval-ROE8X1/workspace/src/files.js#L6) (`return path.join(DATA_ROOT, name);`) | Sanitize `name`, resolve path via `path.resolve`, and verify `resolvedPath.startsWith(DATA_ROOT + path.sep)`. |
| 2 | High | Security | Hardcoded fallback credential for admin authentication | [`src/server.js:5`](file:///C:/tmp/agent-skills-eval-ROE8X1/workspace/src/server.js#L5) (`const token = process.env.ADMIN_TOKEN \|\| 'admin';`) | Require `ADMIN_TOKEN` to be set; fail fast at server start if missing rather than falling back to default `'admin'`. |
| 3 | High | Data Integrity | Destructive migration drops audit logs violating retention policy | [`migrations/003_remove_audit.sql:1`](file:///C:/tmp/agent-skills-eval-ROE8X1/workspace/migrations/003_remove_audit.sql#L1) (`DROP TABLE audit_events;`) vs [`README.md:4`](file:///C:/tmp/agent-skills-eval-ROE8X1/workspace/README.md#L4) | Use additive, non-destructive migrations or archive tables to preserve customer audit records during rolling deploys. |
| 4 | High | Maintainability | Fake test suite provides false green signal without assertions | [`tests/smoke.js:1`](file:///C:/tmp/agent-skills-eval-ROE8X1/workspace/tests/smoke.js#L1) (`console.log('all tests passed');`) vs [`README.md:3`](file:///C:/tmp/agent-skills-eval-ROE8X1/workspace/README.md#L3) | Replace dummy log script with automated HTTP integration and unit tests exercising auth check and path handling. |
| 5 | Medium | Correctness / Reliability | Server returns file system path string instead of file contents | [`src/server.js:11`](file:///C:/tmp/agent-skills-eval-ROE8X1/workspace/src/server.js#L11) (`res.end(requestedFile(...))`) | Stream or read actual file contents using `fs.createReadStream` / `fs.promises.readFile` with 404 and error handling. |

## Unconfirmed Issues

- **Timing Attack on Token Comparison**: `req.headers['x-admin-token'] === token` ([`src/server.js:6`](file:///C:/tmp/agent-skills-eval-ROE8X1/workspace/src/server.js#L6)) uses standard string equality comparison. Requires verification if secret token timing attacks are within threat model (could be mitigated using `crypto.timingSafeEqual`).

## Summary

### Strengths
- Minimal architecture using Node.js native modules without external dependencies.
- Clear separation of file-path resolution ([`src/files.js`](file:///C:/tmp/agent-skills-eval-ROE8X1/workspace/src/files.js)) from HTTP server logic ([`src/server.js`](file:///C:/tmp/agent-skills-eval-ROE8X1/workspace/src/server.js)).

### Key Risks
- **Security Exposure**: Unsanitized path inputs combined with a default hardcoded admin token (`'admin'`) allow unauthorized file system traversal.
- **Data Loss**: Destructive SQL migration (`DROP TABLE audit_events;`) permanently deletes audit records.
- **Lack of Test Coverage**: The project test command succeeds trivially without running any real tests.

### Priority Order
1. **Remediate Path Traversal & Admin Auth**: Reject missing `ADMIN_TOKEN` and validate requested file paths against `DATA_ROOT`.
2. **Fix Database Migration**: Update `003_remove_audit.sql` to avoid dropping audit data.
3. **Implement Real File Serving**: Update `src/server.js` to read and serve file contents with proper status codes (200, 403, 404, 500).
4. **Build Real Test Suite**: Replace `tests/smoke.js` with automated integration tests verifying auth, path boundaries, and HTTP responses.

### Coverage Gaps
- **Production Environment Integration**: Host environment deployment configs (`/srv/customer-files` permissions, environment variables) were not examined.
- **Database Schema**: Database connection and migration runner scripts were not present in the workspace to test SQL execution.
