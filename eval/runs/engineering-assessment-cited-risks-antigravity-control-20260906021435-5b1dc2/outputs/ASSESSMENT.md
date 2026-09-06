# Engineering Assessment: small-file-service

## 1. Scope

- **In Scope**: All codebase files including application entry points (`src/server.js`), helper utilities (`src/files.js`), test suites (`tests/smoke.js`), database migrations (`migrations/003_remove_audit.sql`), build configuration (`package.json`), and project documentation (`README.md`).
- **Out of Scope**: External infrastructure, actual `/srv/customer-files` storage filesystem, deployment pipelines, and environment configuration.
- **Depth**: `deep` — every file in the repository was read and analyzed in full; available automated test tooling was executed and recorded.

---

## 2. Environment

- **Language & Runtime**: JavaScript (Node.js ES Modules, `"type": "module"`)
- **Frameworks & Libraries**: Node.js core modules (`node:http`, `node:path`)
- **Domain**: Microservice / HTTP file access API
- **Build & Test Tooling**: `npm test` (`node tests/smoke.js`)

---

## 3. Tooling Results / What I Ran

Executed standard project verification command:

```
$ npm test

> test
> node tests/smoke.js

all tests passed
```

- **Tools Run Successfully**: `npm test` executed cleanly with exit code 0.
- **Tools Unavailable / Not Configured**: No linter (`eslint`), type checker (`tsc`/`pyright`), audit tool (`npm audit`), or code formatter was configured in `package.json`.

---

## 4. Findings Table (Top 5 Highest-Value Findings)

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | **Critical** | Security | Unsanitized path traversal allows reading arbitrary system files | `src/files.js:6` (`return path.join(DATA_ROOT, name);`) & `src/server.js:11` | Resolve path using `path.resolve` and verify `targetPath.startsWith(path.resolve(DATA_ROOT) + path.sep)` before returning or opening files. |
| 2 | **High** | Security | Hardcoded fallback authentication token defaults to `'admin'` when environment variable is absent | `src/server.js:5` (`const token = process.env.ADMIN_TOKEN \|\| 'admin';`) | Require `ADMIN_TOKEN` to be set explicitly; throw a startup error if missing instead of defaulting to `'admin'`. |
| 3 | **High** | Reliability | Unhandled exception on missing `name` query parameter crashes the HTTP server process | `src/server.js:11` (`searchParams.get('name')`) & `src/files.js:6` | Validate presence of `name` parameter before calling `requestedFile`, return HTTP 400 on bad requests, and wrap request handling in error boundaries. |
| 4 | **High** | Correctness | HTTP response sends the file path string instead of actual file content | `src/server.js:11` (`res.end(requestedFile(...))`) | Replace raw string returning with `fs.createReadStream` or `fs.promises.readFile` to stream file contents and handle missing files (HTTP 404). |
| 5 | **High** | Data Integrity | Un-guarded destructive SQL migration drops historical audit table | `migrations/003_remove_audit.sql:1` (`DROP TABLE audit_events;`) | Avoid dropping tables in production migrations without backup/archival steps or transactional safety mechanisms. |

---

## 5. Unconfirmed / Requires Investigation

- **Placebo Test Suite Execution**: `tests/smoke.js:1` (`console.log('all tests passed');`) does not import `src/server.js` or exercise authentication or file fetching as claimed in `README.md:3`. While confirmed as non-functional, further test infrastructure needs to be authored to determine actual runtime regression behavior.

---

## 6. Summary

### Strengths
- **Minimal Dependencies**: Relies solely on native Node.js ES modules (`node:http`, `node:path`), minimizing external supply chain dependencies.
- **Clear Module Division**: Separates HTTP server routing logic (`src/server.js`) from file path resolution (`src/files.js`).

### Key Risks
- **Security Exploitation**: Path traversal (`src/files.js:6`) combined with default credentials (`src/server.js:5`) allows unauthenticated or trivially authenticated arbitrary file disclosure.
- **Service Availability**: Server process will crash instantly whenever a request is made without a `name` query parameter (`src/server.js:11`).
- **Data Loss**: Running database migrations blindly will permanently delete audit records (`migrations/003_remove_audit.sql:1`).

### Priority Order
1. **Fix Path Traversal (Finding #1)**: Sanitize and validate file path boundaries in `src/files.js:6`.
2. **Harden Authentication (Finding #2)**: Eliminate `'admin'` fallback credential in `src/server.js:5`.
3. **Prevent Crash on Invalid Input (Finding #3)**: Guard query parameters and handle errors gracefully in `src/server.js:11`.
4. **Deliver File Content (Finding #4)**: Read and stream actual file contents in `src/server.js:11`.
5. **Protect Migration Data (Finding #5)**: Remove or guard destructive SQL statements in `migrations/003_remove_audit.sql:1`.

### Coverage Gaps
- **Filesystem Environment**: Real file system permissions and mount structure at `/srv/customer-files` were not accessible in test environment.
- **Database Runtime**: No active database connection or migration execution tool was configured/tested to run `migrations/003_remove_audit.sql`.
