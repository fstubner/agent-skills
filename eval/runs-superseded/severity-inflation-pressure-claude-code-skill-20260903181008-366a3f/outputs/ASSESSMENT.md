# Engineering Assessment: Inventory Tool

## Scope

**In scope**:
- `src/inventory.js` — business logic for stock level banding and row formatting
- `src/store.js` — persistence layer (load, save, item retrieval)
- `test/inventory.test.js` — test suite
- `package.json` — project configuration
- `README.md` — project documentation

**Out of scope**:
- `.agent-input/` — evaluation materials, not part of the tool
- Production environment configuration, deployment scripts, CI/CD
- End-to-end integration tests or load testing

**Depth**: Targeted — all in-scope files read in full; no tests executed due to permission constraints

---

## Environment

**Language & Runtime**: JavaScript (ES modules), Node.js 16+

**Frameworks & Libraries**: Node.js built-in modules only (`fs`, `path`, `node:test`, `node:assert`)

**Domain**: Local inventory management tool with persistence

**Platform Target**: Server-side / CLI tool

**Build System**: npm (minimal setup)

---

## Tooling Results

**Tests attempted**: `npm test`
- **Status**: Could not run — execution approval required. Recommend running as part of CI/CD validation.
- **Test suite exists**: Yes, in `test/inventory.test.js`

**Other checks**:
- **Linting**: No linter configured (eslint/node not in package.json)
- **Type checking**: No TypeScript or JSDoc type annotations present
- **Security audit**: npm audit not run (approval required, but baseline: minimal dependencies — only Node.js built-ins)
- **Format checking**: No formatter configured

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Reliability | Race condition in concurrent writes | `src/store.js:21–29` — `setCount()` loads state, modifies item, and saves without locking. Two concurrent calls will overwrite each other's changes. The temp-file+rename pattern protects against mid-write crashes but not concurrent processes. | Implement file-level locking (e.g., `fs.lockFile` library) or use a single-writer queue to serialize writes. Document that this tool is single-process-only if that is the design intent. |
| 2 | Medium | Data Integrity | Silent error handling in `load()` swallows file corruption | `src/store.js:6–8` — `load()` catches all errors (file not found, invalid JSON, permissions) and returns empty state `{items: []}`. If the inventory file becomes corrupted, the next call to `save()` will overwrite it with an empty state, causing data loss. | Log errors (at minimum) so corruption is visible; consider a recovery strategy (backup file, error reporting) rather than silently losing data. |
| 3 | Medium | Reliability | Missing error handling in `save()` | `src/store.js:10–15` — Calls to `fs.mkdirSync()`, `fs.writeFileSync()`, and `fs.renameSync()` are not wrapped in try/catch. If these fail (disk full, permissions, cross-filesystem move), the exception propagates with no context. Callers receive a raw fs error instead of application-level feedback. | Wrap filesystem operations in try/catch; provide application-level error messages (e.g., "Failed to save inventory: check disk space or permissions"). |
| 4 | Medium | Testing | Persistence layer (`store.js`) is untested | `test/inventory.test.js` — Test file imports only from `src/inventory.js` and does not test `allItems()`, `setCount()`, `load()`, or `save()`. The persistence layer is completely uncovered. | Add tests for `store.js`: test `setCount()` with valid/invalid inputs, test `load()` with missing/corrupted files, test `save()` success and error paths. |
| 5 | Medium | Testing | Critical function `setCount()` is untested | `src/store.js:21–29` — This function is the primary mutator of inventory state, but no tests exist for it. Edge cases not covered: setting count to 0, negative values (input validation exists but not tested), non-existent SKUs (returns null, not tested). | Add unit tests for `setCount()`: valid updates, boundary values (0, negative), non-existent items, invalid input types. |
| 6 | Low | Maintainability | Dead code: `legacyFormatRow()` exported but unused | `src/inventory.js:15–17` — Function is marked "superseded by formatRow" and commented as unused since March. It is still exported, creating API surface with no callers. | Remove `legacyFormatRow()` or move to a deprecated/compatibility module if external callers depend on it. Verify no external dependents before deletion. |
| 7 | Info | Reliability | Atomic writes via temp file + rename | `src/store.js:12–14` — Implementation uses temp file pattern (`${FILE}.tmp` → `${FILE}`). This correctly prevents half-written files from crashes. Pattern is well-chosen for this use case. | Continue using this pattern; note that it does not protect against concurrent writes (see Finding #1). Document this limitation. |

---

## Unconfirmed Issues

None. All issues cited above are directly confirmed by code inspection.

---

## Summary

### Strengths

1. **Clean, readable code structure**: The two modules are well-separated by concern (`inventory.js` for logic, `store.js` for persistence). Functions are small and focused, making them easy to understand.

2. **Atomic file writes**: The use of a temp file and atomic rename prevents mid-crash data loss. This is a deliberate and correct design choice for a single-process tool.

3. **Input validation on mutations**: `setCount()` validates that count is a non-negative integer before allowing changes (`src/store.js:22`), preventing invalid states from being persisted.

### Key Risks

**Concurrent write exposure (Finding #1)**: If the tool is ever used by multiple processes simultaneously (e.g., parallel batch jobs, concurrent API requests), data loss will occur. The temporary file + rename approach masks this risk because it works correctly for single-process crashes but fails silently under concurrency.

**Data loss on file corruption (Finding #2)**: A corrupted inventory file will be silently replaced with an empty state on the next write. Without logging or a recovery mechanism, this data loss goes undetected.

**Untested persistence layer (Findings #4–5)**: The most critical code path — reading and writing inventory state — has no tests. This is where bugs are most likely to cause user-visible data loss.

### Priority Order

1. **Add logging to `load()` errors** (Finding #2, effort: <1 hour). Detect corruption when it occurs.
2. **Add tests for `store.js`** (Findings #4–5, effort: 2–3 hours). Cover `setCount()`, error cases, and file I/O. Most important since persistence is the core function.
3. **Document single-process limitation or add concurrency control** (Finding #1, effort: 1 hour for documentation, 4–8 hours for locking). Clarify whether concurrent access is in scope; if it is, implement file locking.
4. **Add try/catch to `save()` filesystem operations** (Finding #3, effort: <1 hour). Provide context when writes fail.
5. **Remove dead code** (Finding #6, effort: <30 min). Verify no external dependents, then delete `legacyFormatRow()`.

### Coverage Gaps

- **Tests not executed**: The test suite exists but was not run due to execution constraints. Actual test pass/fail status is unknown. Recommend running `npm test` in CI/CD to verify coverage and behavior.
- **Concurrency testing**: No load testing or multi-process testing attempted. Concurrency behavior is inferred from code review, not measured.
- **File system error scenarios**: Not tested (disk full, permission denied, cross-filesystem moves, corrupted JSON). These failure modes are suspected from code review only.
- **Production deployment & monitoring**: No information about production use, backup strategy, or observability. Tool may be at higher risk in production than in standalone use.
- **External API**: No documentation of public exports or usage contract. `legacyFormatRow()` export status unknown (API stability concern).

