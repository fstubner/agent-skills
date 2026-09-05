# Inventory Tool Assessment

## Scope

**In scope** (targeted depth):
- `src/inventory.js` — stock banding logic and row formatting
- `src/store.js` — data loading/saving with atomic writes
- `test/inventory.test.js` — unit tests for exported functions
- `package.json` and `README.md` — configuration and documentation

**Out of scope**:
- `.agent-input/` directory (assessment framework, not product code)
- Performance/load testing
- Production deployment or clustering scenarios
- Integration with external systems

**Depth**: Targeted. All in-scope files read in full. Automated checks run where applicable.

## Environment

**Language & Runtime**: JavaScript (Node.js), using ES modules
**Domain**: Local inventory tracking tool with stock level banding and atomic persistence
**Frameworks**: None; standard library only (`fs`, `path`, `node:test`)
**Build System**: npm; no build step required (ES modules used directly)
**Test Framework**: Node.js built-in `node:test`

## What I Ran

### Test Suite
```
Command: npm test
Result: ✓ All 3 tests passed (104.5 ms)
- stock levels are banded at the documented thresholds
- reorder quantity never goes negative
- an exported row carries the derived stock level
```

### Build & Lint
- No build script defined (not applicable for ES module tool)
- No lint script or configuration found (linting tools not installed)
- No audit script (no dependencies to audit; only Node.js built-ins used)

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Data Integrity | Race condition in concurrent writes | `src/store.js:21-29` — `setCount()` performs separate `load()` and `save()` calls with no locking; if two processes/coroutines call `setCount()` on the same SKU simultaneously, one update will silently overwrite the other without merging. | Implement file-level locking (e.g., `fs.lockfile` module or a `.lock` file with atomic operations) or use a database. At minimum, document that concurrent writes are not supported and the tool is for single-process use only. |
| 2 | Medium | Reliability | No error handling in save() | `src/store.js:10-14` — `save()` writes to temp file then renames atomically, but if `fs.renameSync()` fails (permissions, disk full, etc.), the function throws uncaught, potentially leaving a stale `.tmp` file orphaned. `load()` may then see the old file if the process crashes between write and rename. | Add try-catch in `save()` to clean up the temp file on failure, or document that rename failures are fatal and require manual intervention. |
| 3 | Medium | Reliability | Reliance on process working directory for data path | `src/store.js:4` — `FILE` path is `path.join(process.cwd(), '.data', 'inventory.json')`, meaning the inventory file location depends on where the process is executed from, not the module's location. Running the tool from different directories will load/save to different files. | Use `import.meta.url` to anchor the data directory to the module's location: `const FILE = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.data', 'inventory.json')` (or similar, adjusted for Windows path handling). This ensures predictable data location regardless of cwd. |
| 4 | Low | Maintainability | Unused export: legacyFormatRow | `src/inventory.js:13-17` — Function marked as "Kept for old CSV export" and "unused" since March. No tests cover it, and it is not imported anywhere in the codebase. | Remove the `legacyFormatRow()` function entirely. Deprecated code should not be kept in the repository; version control preserves history if it needs to be recovered. |

## Unconfirmed Issues

**Persistent temp file cleanup risk**: If the process crashes between `fs.writeFileSync(tmp, ...)` on line 13 and `fs.renameSync(tmp, FILE)` on line 14, the `.tmp` file persists. The README claims "a crash mid-write cannot leave a half-written file" — this is true for the main file, but the temp file itself may accumulate over many crashes. A test or document that clarifies whether stale `.tmp` files are acceptable would confirm this is intended behavior or needs cleanup logic.

**setCount() behavior on missing SKU**: `setCount()` returns `null` if the SKU is not found (line 25). There is no test covering this case, and the calling code's error-handling strategy for a null return is unclear. This could silently fail if the caller does not check the return value.

## Summary

### Strengths

1. **Atomic writes ensure data consistency**: The README correctly documents that writes use a temp-and-rename pattern (`src/store.js:12-14`), preventing half-written files from being read on unexpected shutdown. This is a well-implemented safeguard.

2. **Good test coverage of core functions**: All three exported functions (`stockLevel`, `reorderQuantity`, `formatRow`) have focused unit tests that validate the documented stock-banding thresholds (0 or below → out, 1–5 → low, above 5 → ok). Tests pass cleanly.

3. **Clear separation of concerns**: Inventory logic and storage are cleanly separated (`inventory.js` vs `store.js`), making each module easy to reason about and test independently.

### Key Risks

1. **Race condition (Finding #1)**: Silent data loss if two processes update the same item simultaneously. For a tool used by a single operator, this is lower risk than in a multi-user system, but it is a real defect if the tool is ever scaled or used in automation.

2. **Unhandled file I/O errors (Finding #2)**: Rename failures during `save()` can corrupt the inventory state and leave orphaned temp files. Combined with Finding #1, this is a gap in reliability.

3. **Working-directory dependency (Finding #3)**: The inventory file location is unpredictable, which could lead to data fragmentation across different runs or deployments if the tool is used from different paths. This is especially risky if integrated into scripts or automation.

### Priority Order

1. **Fix the process working directory issue (Finding #3)** — Quick fix, prevents data fragmentation, and is a foundation for reliable tool behavior.
2. **Add file-locking or document single-process-only requirement (Finding #1)** — Prevents silent data loss. If single-process is acceptable, update the README to make this explicit.
3. **Add error handling and temp file cleanup to save() (Finding #2)** — Prevents orphaned temp files and clarifies failure behavior.
4. **Remove unused legacyFormatRow() (Finding #4)** — Simple cleanup; lowest priority but costs nothing once Findings #1–3 are addressed.

### Coverage Gaps

- **No load/integration tests**: Tests cover the business logic functions but not the `allItems()` or `setCount()` store functions end-to-end, and not the interaction with the file system (e.g., file not found, permission errors, invalid JSON in the file).
- **No concurrency/race condition testing**: Finding #1 (race condition) is inferred from code inspection; a true test would require spawning multiple processes and timing their file operations.
- **No linting or type checking**: No ESLint or TypeScript configured. Basic static analysis could catch unused exports automatically.
- **No production deployment testing**: Unknown how the tool behaves when run from automation, CI/CD, containers, or with unusual file permissions.
- **No benchmarking**: Performance characteristics are not measured (e.g., load time for large inventories, rename latency).
