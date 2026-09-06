# Engineering Assessment

## Scope

- **In Scope**: All files in workspace (`src/server.js`, `src/files.js`, `migrations/003_remove_audit.sql`, `tests/smoke.js`, `package.json`, `README.md`).
- **Out of Scope**: None.
- **Depth**: `deep` — every workspace file opened and read in full; all automated tools run.

## Environment

- **Languages & Runtimes**: Node.js (ES modules, `"type": "module"`)
- **Frameworks & Libraries**: Node native modules (`node:http`, `node:path`)
- **Domain**: HTTP file service
- **Platform Target**: Node.js server
- **Build Systems & Tooling**: npm (`npm test`)

## Tooling Results

### What I Ran

```
$ npm test

> test
> node tests/smoke.js

all tests passed
```

- **Tools run successfully**: `npm test` (executed `node tests/smoke.js` and exited with code 0).
- **Tools unavailable**: `eslint`, `tsc` (no linter or typechecker configured in `package.json`).

---

## Findings Table (Limited to Top 5 Highest-Value Findings)

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | Critical | Security | Unrestricted Path Traversal (Arbitrary File Read) | [src/files.js:5-7](file:///C:/tmp/agent-skills-eval-bP4LFY/workspace/src/files.js#L5-L7) uses `path.join('/srv/customer-files', name)` without sanitizing `name`, allowing directory traversal (e.g. `?name=../../etc/passwd`). | Sanitize and resolve `name` relative to `DATA_ROOT`, ensuring `resolvedPath.startsWith(DATA_ROOT + path.sep)`. |
| 2 | Critical | Security | Hardcoded Authentication Fallback Secret | [src/server.js:5](file:///C:/tmp/agent-skills-eval-bP4LFY/workspace/src/server.js#L5) falls back to `'admin'` when `process.env.ADMIN_TOKEN` is unset, allowing default credential access. | Remove default token fallback; require `ADMIN_TOKEN` to be set or fail closed. |
| 3 | Critical | Data Integrity | Irreversible Destructive Schema Migration | [migrations/003_remove_audit.sql:1](file:///C:/tmp/agent-skills-eval-bP4LFY/workspace/migrations/003_remove_audit.sql#L1) executes `DROP TABLE audit_events;`, causing permanent data loss for audit logs. | Use non-destructive, additive migrations or deprecation strategies instead of dropping tables containing audit/customer data. |
| 4 | High | Reliability / Testing | Smoke Test Does Not Exercise Service Logic | [tests/smoke.js:1](file:///C:/tmp/agent-skills-eval-bP4LFY/workspace/tests/smoke.js#L1) only prints `"all tests passed"` without executing authentication, HTTP handlers, or path functions, contradicting [README.md:3](file:///C:/tmp/agent-skills-eval-bP4LFY/workspace/README.md#L3). | Implement actual unit/integration tests for `authorized()`, `requestedFile()`, and the HTTP endpoint. |
| 5 | Medium | Reliability | Missing HTTP Response Headers and Error Handling | [src/server.js:11](file:///C:/tmp/agent-skills-eval-bP4LFY/workspace/src/server.js#L11) returns raw file path strings without `Content-Type`, HTTP status codes for missing parameters/files, or `try/catch` stream handling. | Add proper HTTP headers, status codes (400, 404, 500), and async file stream/error handling. |

---

## Unconfirmed Issues

*None.*

---

## Summary

### Strengths
- Minimal dependency footprint using native Node.js ES modules without bloated third-party overhead.
- Clear separation of route authorization logic (`authorized`) and path resolution (`requestedFile`).

### Key Risks
- Remote attackers with or without default credentials can extract system files via path traversal (Finding #1, #2).
- Database migrations permanently erase audit history (Finding #3).
- Test pipeline provides false confidence by passing without testing any code (Finding #4).

### Priority Order
1. **Fix Path Traversal**: Enforce boundary checks on `name` parameters in [src/files.js](file:///C:/tmp/agent-skills-eval-bP4LFY/workspace/src/files.js).
2. **Remove Default Auth Secret**: Fail server startup if `ADMIN_TOKEN` is not defined in [src/server.js](file:///C:/tmp/agent-skills-eval-bP4LFY/workspace/src/server.js).
3. **Revert/Revise Migration**: Replace `DROP TABLE audit_events;` in [migrations/003_remove_audit.sql](file:///C:/tmp/agent-skills-eval-bP4LFY/workspace/migrations/003_remove_audit.sql) with backwards-compatible schema changes.
4. **Implement Real Automated Tests**: Replace [tests/smoke.js](file:///C:/tmp/agent-skills-eval-bP4LFY/workspace/tests/smoke.js) with automated assertion tests for auth and file retrieval.
5. **Add HTTP Error & Stream Handling**: Improve status codes and header handling in [src/server.js](file:///C:/tmp/agent-skills-eval-bP4LFY/workspace/src/server.js).

### Coverage Gaps
- End-to-end HTTP request integration tests under actual OS execution.
- Real database setup and migration engine execution (only SQL file was inspected).
