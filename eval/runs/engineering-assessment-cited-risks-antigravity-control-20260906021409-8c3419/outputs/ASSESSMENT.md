# Engineering Assessment

## Scope

- **In Scope**: All repository files (`src/server.js`, `src/files.js`, `migrations/003_remove_audit.sql`, `tests/smoke.js`, `package.json`, `README.md`).
- **Depth**: `deep` — every file in the repository was read and analyzed in full; standard project commands were executed and evaluated.
- **Out of Scope**: Production deployment configuration and database runtime environment (not present in repository).

## Environment

- **Runtime**: Node.js (ES Modules format).
- **Core Libraries**: Built-in `node:http` and `node:path`.
- **Tooling & Test Framework**: Standard `npm` scripts executing `node tests/smoke.js`.

## Tooling Results

### What I Ran

Executed project test suite via `npm test`:

```
> test
> node tests/smoke.js

all tests passed
```

**Outcome**: Exited with code `0`. However, static analysis reveals `tests/smoke.js` is a static print stub that does not execute server code or verify any application logic.

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | **Critical** | Security | Hardcoded default fallback for administrative authentication token | `src/server.js:5` (`const token = process.env.ADMIN_TOKEN \|\| 'admin';`) | Remove `'admin'` fallback. Enforce strict failure (fail-closed) when `ADMIN_TOKEN` is unset in production. |
| 2 | **Critical** | Security | Path traversal vulnerability permitting arbitrary host file read | `src/files.js:6` (`return path.join(DATA_ROOT, name);`) & `src/server.js:11` | Resolve relative paths and verify that the target path remains within `DATA_ROOT` bounds before returning. |
| 3 | **High** | Data Integrity | Destructive database migration permanently deleting audit log table | `migrations/003_remove_audit.sql:1` (`DROP TABLE audit_events;`) | Replace `DROP TABLE` with a non-destructive migration strategy or archiving step to prevent data loss. |
| 4 | **High** | Testing / Reliability | No-op smoke test producing false-positive test suite status | `tests/smoke.js:1` (`console.log('all tests passed');`) | Implement automated HTTP integration tests verifying authentication checks and file retrieving logic. |
| 5 | **Medium** | Reliability | Server process crash (`TypeError`) when `name` query parameter is omitted | `src/server.js:11` (`searchParams.get('name')`) | Validate presence of `name` parameter and handle errors gracefully with an appropriate HTTP error status (e.g., 400 Bad Request). |

## Unconfirmed Issues

*None. All five findings are confirmed directly by static code inspection and execution.*

## Summary

### Strengths

1. **Zero External Runtime Overhead**: Uses built-in Node.js modules (`node:http`, `node:path`) with zero external package dependencies in `package.json`.
2. **Standardized Execution Entry Points**: Clean npm script definitions (`start`, `test`) matching standard Node.js workflow conventions.

### Key Risks

- **Authentication Bypass & Data Exposure (Findings #1 & #2)**: Default credentials combined with unvalidated path joining allow unauthorized users to extract arbitrary system files.
- **Unbacked Data Retention Claims (Finding #3)**: The SQL migration violates data safety promises stated in project documentation.
- **Untested Application Paths (Findings #4 & #5)**: The test suite passes falsely while basic requests without query parameters crash the HTTP server.

### Priority Order

1. **Remediate Security Boundary (Finding #1)**: Remove hardcoded fallback token in `src/server.js` to ensure unauthenticated requests are rejected.
2. **Fix Path Traversal (Finding #2)**: Sanitize `name` inputs in `src/files.js` to restrict access strictly to `DATA_ROOT`.
3. **Prevent Unintentional Data Loss (Finding #3)**: Revise `migrations/003_remove_audit.sql` to avoid dropping production audit tables.
4. **Implement Request Validation (Finding #5)**: Add null checks and top-level error handling in `src/server.js`.
5. **Establish Valid Integration Tests (Finding #4)**: Replace `tests/smoke.js` with functional HTTP request assertions.

### Coverage Gaps

- **Database Execution Layer**: No database connection logic or migration runner code exists in the repository to evaluate execution safety.
- **Production Server Infrastructure**: Reverse proxy, SSL/TLS, environment variable provisioning, and deployment container specs were unavailable.
