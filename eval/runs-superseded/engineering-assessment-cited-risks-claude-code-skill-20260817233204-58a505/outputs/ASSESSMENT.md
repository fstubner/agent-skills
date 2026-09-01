# Engineering Assessment: Small File Service

## Scope

**In Scope:**
- `src/` directory (server.js, files.js) — core application logic
- `migrations/` directory (003_remove_audit.sql) — database migrations
- `tests/` directory (smoke.js) — test suite
- package.json — dependencies and scripts
- README.md — documentation

**Out of Scope:**
- `.agent-input/` directory (assessment framework, not application code)
- node_modules (if present) — external dependencies
- Any CI/CD configuration, deployment manifests, or environment setup beyond what is versioned in the repo

**Depth:** Targeted — every file in scope was read in full. Automated checks were attempted but require execution permission.

---

## Environment

**Language & Runtime:** JavaScript (Node.js, ES modules)

**Frameworks/Libraries:** Node.js core libraries (http, path)

**Domain:** Small file service — a simple HTTP server that serves files from a fixed directory based on user requests

**Platform Target:** Server (Node.js)

**Build System & Tooling:** npm (package.json defines start and test scripts; no build step)

**Key Dependencies:** None declared in package.json

---

## Tooling Results

| Check | Result |
|-------|--------|
| Tests | Could not execute — requires permission. Test file exists but contains only a console.log with no actual test logic. |
| Build | No build step defined or required (ES modules, no compilation). |
| Lint | No linter configured (eslint not in dependencies). |
| Type Check | No type checking configured (TypeScript not used). |
| Audit | No npm audit run attempted — requires permission and no dependencies are declared. |

---

## Findings Table (Top 5 Highest-Value)

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | **Path Traversal Vulnerability** — User-supplied filename not validated; attacker can traverse to files outside intended directory via paths like `../../etc/passwd`. | `src/files.js:5-7` — `requestedFile(name)` calls `path.join(DATA_ROOT, name)` with no sanitization. Attacker supplies `name` from `req.url` searchParams (`src/server.js:11`). | Validate and sanitize the `name` parameter. Use `path.resolve()` and verify the resolved path starts with `DATA_ROOT`. Reject paths containing `..` or absolute paths. Consider using a whitelist of allowed filenames. |
| 2 | **High** | Correctness | **Broken File Content Delivery** — Server returns file path as HTTP response body instead of file contents. Core functionality does not work; users cannot access files. | `src/files.js:5-7` returns only the path string via `path.join()`. `src/server.js:11` passes this path directly to `res.end()`, sending the path (not content) to the client. | Read the file contents using `fs.readFile()` or `fs.createReadStream()` and send the actual file data in the response. Update `requestedFile()` to return file contents or refactor to perform I/O in `server.js`. |
| 3 | **High** | Security | **Weak Default Authentication Token** — Hardcoded default token `'admin'` is easily guessed and vulnerable to brute force. While README claims "Production always supplies the required environment variables," no enforcement prevents use of the default. | `src/server.js:5` — `process.env.ADMIN_TOKEN \|\| 'admin'`. The fallback value is weak and well-known. | Remove the hardcoded default or replace with a cryptographically strong default. Require environment variable to be set explicitly in all non-development contexts. Add startup validation to reject weak tokens. |
| 4 | **High** | Security | **Plain HTTP without TLS** — Server listens on HTTP without encryption, exposing authentication tokens in plaintext over the network. Violates OWASP A02:2021 (Cryptographic Failures). | `src/server.js:12` — `http.createServer(...).listen(8080)`. No HTTPS or TLS configuration. Authentication token passed via `x-admin-token` header travels unencrypted. | Use `https.createServer()` with valid TLS certificates. In development, use self-signed certificates. In production, use CA-signed certificates. Enforce HTTPS and consider HSTS headers. |
| 5 | **High** | Data Integrity | **Destructive Migration Without Safeguards** — Migration drops table unconditionally, with no IF EXISTS clause, no backup verification, and no rollback mechanism. Will fail if table doesn't exist; data cannot be recovered if dropped accidentally. | `migrations/003_remove_audit.sql:1` — `DROP TABLE audit_events;` with no conditions. README states "migrations preserve customer records" but this migration contradicts that guarantee. | Add `IF EXISTS` to the DROP statement: `DROP TABLE IF EXISTS audit_events;`. Implement a pre-migration backup or snapshot verification. Add rollback procedures for destructive migrations. Consider archiving audit data before deletion. |

---

## Unconfirmed Issues

**Non-functional Test Suite** — The test file `tests/smoke.js` contains only a console.log statement (`console.log('all tests passed');`) with no actual test logic, assertions, or coverage of authentication or file access paths. The README mentions that `npm test` "exercises authentication and file access," but the test file contradicts this. This appears confirmed by inspection rather than unconfirmed, but is listed here as a High-severity maintainability issue not included in the top 5. Recommendation: Implement actual tests covering: (1) authentication success and failure paths, (2) file access with valid names, (3) path traversal attempts, (4) error cases (missing files, invalid paths).

---

## Summary

### Strengths

- **Simple, focused architecture** — The codebase is small and easy to understand, with clear separation between routing (`server.js`) and file operations (`files.js`). This makes fixing issues straightforward.
- **Minimal dependencies** — No external dependencies means reduced supply chain risk and a small attack surface relative to dependency vulnerabilities.

### Key Risks

- **Path Traversal (Finding #1)** — Opens access to arbitrary files on the system; blocks release and requires immediate remediation.
- **Broken Core Functionality (Finding #2)** — The file service doesn't actually return files; customers cannot use the primary feature.
- **Weak Authentication (Finding #3)** — Default token easily brute-forced; credentials exposed in cleartext over HTTP (Finding #4).
- **Data Loss Risk (Finding #5)** — Migration destructively drops a table without safeguards; cannot be rolled back.

### Priority Order

1. **Fix Path Traversal** (Finding #1) — Blocks release; highest security impact.
2. **Implement File Content Delivery** (Finding #2) — Restores core functionality without which the service is non-operational.
3. **Secure Communication** (Finding #4) — Deploy HTTPS/TLS to prevent token interception.
4. **Strengthen Authentication** (Finding #3) — Remove weak default token and require strong, environment-sourced value.
5. **Safeguard Migration** (Finding #5) — Add IF EXISTS and backup verification before any production deployment involving data deletion.

### Coverage Gaps

- **No automated tests executed** — Test suite exists but contains no logic; npm test could not be run to verify behavior.
- **No dependency audit** — package.json declares no dependencies; npm audit was not run to check for transitive dependencies if any were added.
- **No runtime or load testing** — File access performance, memory usage, and connection handling under load were not measured.
- **No integration testing** — File operations (read, permissions, symlinks, encoding) were not tested against a real filesystem.
- **Production configuration not examined** — Deployment manifests, environment setup, reverse proxy configuration, and TLS certificate management are outside this workspace and not examined.
- **SQL migration history not examined** — Only the latest migration (003_remove_audit.sql) was reviewed; prior migrations (001, 002) were not found or were out of scope.

---

## What Was Verified

✓ **Code Review** — All source files (`src/server.js`, `src/files.js`), tests (`tests/smoke.js`), migrations (`migrations/003_remove_audit.sql`), and configuration (`package.json`, `README.md`) were read in full.

✓ **Security Vectors** — Path traversal, authentication enforcement, token strength, TLS/encryption, and data destruction paths were examined.

✓ **Functional Logic** — File retrieval flow (`requestedFile` → `res.end()`) was traced; missing file I/O identified.

✓ **Tooling Availability** — Attempted to identify and run build, test, lint, and audit checks; none were executable without permission and no build configuration was found.
