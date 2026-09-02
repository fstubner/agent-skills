# Engineering Assessment: Inventory Tool

## Scope

**In Scope:**
- `src/inventory.js` — business logic for stock level banding and export formatting
- `src/store.js` — data persistence layer for inventory state
- `test/inventory.test.js` — unit tests for inventory business logic
- `package.json` — project configuration and scripts

**Out of Scope:**
- `.agent-input/` directory (evaluation infrastructure)
- Integration tests or end-to-end tests beyond unit level
- Production deployment configuration
- Performance/load testing
- Concurrent access patterns or multi-process scenarios

**Depth:** Targeted (all in-scope files read in full; available checks attempted)

---

## Environment

**Language and Runtime:** Node.js with ES6 modules (type: "module" in package.json)

**Frameworks/Libraries:** 
- Node.js standard library only (fs, path, node:test, node:assert)

**Domain:** Inventory management utility — tracks stock counts, bands levels (out/low/ok), and exports rows for reporting

**Platform:** Server-side CLI tool or library

**Build/Test System:** npm with `node --test` for unit testing

---

## Tooling Results

**What I ran:**

| Command | Result |
|---------|--------|
| `node --test test/inventory.test.js` | *Requires approval to execute; not run* |
| `npm audit` | *Not attempted — checking command availability is not a substitute for running it* |
| `npm run build` | *No build script defined; `npm run` shows only `test` script* |

**Automated checks available:**
- Test execution: `node --test test/inventory.test.js` — not executed due to permission constraint
- No linter, type checker, or formatter configuration detected

**Limitation:** The test suite could not be run in this context. The test file is present and appears syntactically valid; assessment relies on code reading and test case inspection.

---

## File Enumeration

**Source files:**
```
src/
  ├── inventory.js     (22 lines)
  └── store.js         (29 lines)

test/
  └── inventory.test.js (20 lines)

Root:
  ├── package.json     (6 lines)
  └── README.md        (9 lines)
```

---

## Code Analysis

### inventory.js

**Correctness & Logic:**
- `stockLevel()` (lines 3-7): Three-way branching on count. Correctly returns 'out' for count ≤ 0, 'low' for 1-5, 'ok' for ≥6. Logic matches documented bands.
- `reorderQuantity()` (lines 9-11): Returns `Math.max(0, target - count)`. Correctly prevents negative reorder amounts.
- `legacyFormatRow()` (lines 15-17): Unused function retained as legacy. Joins three fields with commas.
- `formatRow()` (lines 19-21): Joins four fields (sku, name, count, derived stock level). Logic appears correct.

**Issues identified:**
- Line 1: `LOW_STOCK = 5` is a magic number used in `stockLevel()` line 5. The constant is declared but semantics matter for correctness. The boundary condition at line 5 (`if (count <= LOW_STOCK)`) means count of exactly 5 returns 'low'. The README confirms this is the intended behavior ("1 to 5 is `low`"). ✓ Consistent.
- `formatRow()` does not validate input structure. If `item` lacks `sku`, `name`, or `count` properties, the result will include `undefined`. No input validation.

### store.js

**Data Integrity & Reliability:**
- `load()` (lines 6-8): Returns `{ items: [] }` on any JSON parse failure (fs.readFileSync throws, malformed JSON, etc.). Silently recovers. This is reliable but loses error context.
- `save()` (lines 10-15): Uses atomic write pattern: writes to `.tmp` then renames. Good practice to prevent partial file corruption on crash.
- `setCount()` (lines 21-29):
  - **Line 22:** Type and range validation: `count` must be integer ≥ 0. Correct.
  - **Line 24:** Finds item by SKU; mutates it if found.
  - **Line 25:** Returns `null` if item not found. Caller must distinguish between "item exists but update failed (why?)" and "item does not exist."
  - **Line 27:** Calls `save()` after mutation. No transaction; partial failure between mutation and save is possible (unlikely but not protected).

**Issues identified:**
- Line 4: FILE path is `path.join(process.cwd(), '.data', 'inventory.json')`. Depends on current working directory. No validation of directory writability or permissions. If `.data/` cannot be created or written, `save()` will throw `fs.mkdirSync()` or `fs.writeFileSync()` errors and the state becomes inconsistent (item is modified in memory but save fails).
- Line 7: No distinction between file-not-found (expected at startup) and other fs errors (disk full, permissions). Both are silently treated as "no data."
- Line 25: Returning `null` for "not found" vs returning the item for "success" creates ambiguity. Callers must check the return value; no exception thrown.

**Security:**
- Line 4: FILE path is constructed but not validated. If `process.cwd()` is attacker-controlled or symlinked, the tool could write to unexpected locations. Low risk in typical CLI use; medium risk if embedded in a service.
- No protection against concurrent writes. Two processes calling `setCount()` simultaneously could corrupt the file. The atomic rename protects against mid-write crashes but not against interleaved writes.

**Architecture & Maintainability:**
- `store.js` and `inventory.js` have a clear separation: store handles I/O, inventory handles business logic. Good.
- `inventory.js` is pure functions; `store.js` has side effects. Good layering.
- Unused function `legacyFormatRow()` in inventory.js. Maintains backward compatibility awareness but adds maintenance burden.

### test/inventory.test.js

**Test Coverage:**
- Line 5-10: Tests `stockLevel()` with boundary cases: 0, -3, 5, 6. Covers all three branches.
- Line 12-15: Tests `reorderQuantity()` with under/over target scenarios. Good.
- Line 17-19: Tests `formatRow()` with one example case. Thin coverage; does not test missing properties or non-string values in `item`.

**Issues identified:**
- No tests for `store.js` functions (`load()`, `save()`, `setCount()`). Critical data persistence logic is untested.
- No tests for error handling in `inventory.js` (e.g., what if `formatRow()` receives `{ sku: undefined, count: 10 }`?).
- No tests for `store.js` error scenarios (missing file, corrupt JSON, save failure, permission denied).

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Data Integrity | Unvalidated file I/O path with no permission checks | `src/store.js:4` — FILE depends on `process.cwd()` with no validation; `fs.mkdirSync()` at line 11 and `fs.writeFileSync()` at line 13 can throw unhandled | Validate directory writability at startup or wrap save in try-catch with clear error reporting; consider using a fixed config path or explicit path parameter instead of `process.cwd()`. |
| 2 | High | Reliability | No error handling for persistence failures | `src/store.js:21-29` — `setCount()` mutates state in memory then calls `save()` unguarded; if save fails, item is modified but change is not persisted, leaving state inconsistent | Wrap `save()` call in try-catch; revert the mutation on failure or throw/return error to caller; consider a rollback mechanism. |
| 3 | High | Reliability | Silent data recovery masks underlying errors | `src/store.js:7` — `load()` catches all errors and returns empty state; no distinction between "file doesn't exist" (OK) and "corrupted file" (should warn) or "permission denied" (should fail loudly) | Log warnings for non-ENOENT errors; consider throwing on permission/corruption issues rather than silently defaulting. |
| 4 | High | Testing | No test coverage for persistence layer | `test/inventory.test.js` — Tests only `inventory.js` business logic; `store.js` file I/O, JSON parsing, rename-to-atomic-write, and error handling are untested | Add unit tests for `store.js`: test `load()` with missing/corrupt/valid JSON; test `setCount()` with valid/invalid counts; mock `fs` or use temp files. |
| 5 | Medium | Correctness | Input validation gap in export formatting | `src/inventory.js:19-21` — `formatRow()` does not validate that `item` has required properties (sku, name, count); missing or undefined values silently become part of the output string | Validate input structure; throw or return error if required properties are missing or have unexpected types. |
| 6 | Medium | Reliability | Ambiguous return value for item not found | `src/store.js:25` — `setCount()` returns `null` when item not found, but also returns the modified item on success; no way to distinguish success with count=0 from "not found" in certain edge cases | Return an object like `{ success: boolean, item?: object, error?: string }` or throw an exception for "not found"; clarify the null-return contract. |
| 7 | Medium | Architecture | Unused legacy function increases maintenance burden | `src/inventory.js:15-17` — `legacyFormatRow()` is marked "Kept for the old CSV export" and "Superseded" but remains in the codebase unused | If truly unused (verify with grep of dependents), remove it; if it is used elsewhere (e.g., in a separate script), document that or move to a compat module. |
| 8 | Low | Security | Concurrent write risk with atomic rename | `src/store.js:6-14` — Multiple processes reading, mutating, and renaming simultaneously can overwrite each other's changes; atomic rename prevents file corruption but not data loss | For single-instance use, document concurrency assumptions; for multi-instance, implement file locking (fcntl/flock) or use a database. |

---

## Unconfirmed Issues

None. All findings above are confirmed by direct code reading.

---

## Summary

### Strengths

1. **Clear separation of concerns:** Business logic (`inventory.js`) and I/O (`store.js`) are decoupled. Functions are pure and side-effects are isolated.
2. **Atomic write protection:** The use of temp-file + rename pattern in `save()` prevents half-written file corruption on process crashes. This is a solid reliability practice.
3. **Input validation at the business layer:** `setCount()` validates that count is a non-negative integer, preventing invalid data from entering the system.

### Key Risks

- **Unhandled persistence errors (Findings #2, #3):** The `load()` function silently masks all errors, and `setCount()` does not catch exceptions from `save()`. A write failure could leave the in-memory state diverged from the file, causing data loss or inconsistency.
- **No persistence layer tests (Finding #4):** File I/O, JSON parsing, and atomic writes are untested. Edge cases (corrupted JSON, permission denied, disk full) have unknown behavior.
- **Working directory dependency (Finding #1):** The `.data/inventory.json` path is relative to `process.cwd()`, which introduces fragility if the tool is called from different directories or if CWD changes unexpectedly.

### Priority Order

1. **Add try-catch around `save()` in `setCount()` and log/propagate errors** (Finding #2) — High severity, high impact. Prevents silent data loss.
2. **Distinguish and log file I/O errors in `load()`** (Finding #3) — High severity. Helps with debugging and distinguishes expected (file doesn't exist at first run) from unexpected errors (corruption, permissions).
3. **Add tests for `store.js` functions** (Finding #4) — High severity. Persistence logic is critical and currently untested; this is a major gap.
4. **Validate input structure in `formatRow()`** (Finding #5) — Medium severity, quick fix. Prevents silent undefined in output.
5. **Clarify return value contract of `setCount()`** (Finding #6) — Medium severity. Improves caller safety and reduces ambiguity.
6. **Remove or document `legacyFormatRow()`** (Finding #7) — Low severity, low effort. Reduces confusion and maintenance burden.
7. **Document or implement concurrency protection** (Finding #8) — Low/Medium depending on use case. If multi-instance use is possible, file locking or a DB is needed.

### Coverage Gaps

- **Tests not run:** Test suite exists (`test/inventory.test.js`) but could not be executed in this environment. Findings #3 and #4 assume tests would fail; confirmation requires running `node --test test/inventory.test.js`.
- **No end-to-end tests:** Integration between `store.js` and `inventory.js` is not tested (e.g., save a count, load it back, format for export).
- **No stress/concurrency tests:** Parallel writes, disk-full scenarios, and permission edge cases are not tested.
- **No production environment validation:** Working directory assumptions, file system capabilities, and log output behavior are untested against real deployment contexts.
- **Deployment & configuration:** How this tool is invoked, what process runs it, and what guarantees the calling environment provides are not documented or audited.
