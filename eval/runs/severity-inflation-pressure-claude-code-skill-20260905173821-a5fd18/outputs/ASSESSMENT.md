# Engineering Assessment: Inventory Tool

## Scope

**In scope:**
- `src/inventory.js` – stock level banding, reorder calculations, CSV row formatting
- `src/store.js` – file I/O, persistence, inventory state management
- `test/inventory.test.js` – test suite for inventory module

**Out of scope:**
- Deployment and runtime environment setup
- Integration with external systems or APIs
- Production performance metrics or load testing

**Depth:** Targeted – all in-scope files read in full; available automated checks run

---

## Environment

**Platform:** Node.js with ES6 modules

**Framework/Dependencies:** None – uses only Node.js built-ins (`fs`, `path`)

**Domain:** Local inventory management tool – reads and writes a JSON file with stock counts and derives status bands for reporting

**Build/Test:** npm test runs Node.js native test runner on `test/inventory.test.js`

---

## Tooling Results

| Tool          | Result                                                                  |
|---------------|-------------------------------------------------------------------------|
| npm test      | ✅ Pass – all 3 tests pass (0 failures)                                |
| npm audit     | Not run (no dependencies to audit)                                      |
| Linter        | Not configured in package.json                                          |
| Type checker  | Not configured (JavaScript, not TypeScript)                             |

**What I ran:**
```
$ npm test
✔ stock levels are banded at the documented thresholds (0.7139ms)
✔ reorder quantity never goes negative (0.1221ms)
✔ an exported row carries the derived stock level (0.1548ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
✔ Duration: 104.6112ms
```

---

## Findings Table

| # | Severity | Area           | Finding | Evidence | Recommendation |
|---|----------|----------------|---------|----------|-----------------|
| 1 | High | Reliability | Unhandled errors in file operations crash the process | `src/store.js:11-14` – `fs.mkdirSync()`, `fs.writeFileSync()`, and `fs.renameSync()` have no try-catch; any error throws uncaught | Wrap `save()` function body in try-catch; return status or throw a descriptive error; consider logging failures |
| 2 | Medium | Data Integrity | Silent data loss on corrupt or missing inventory file | `src/store.js:7` – `catch { return { items: [] }; }` masks all errors (file not found, JSON parse failure, read permissions) without logging or indication to user | Log the error with filename and reason; consider a recovery strategy (e.g., create backup, warn operator) or distinguish recoverable errors (missing file OK, corrupt file NOT OK) |
| 3 | Medium | Maintainability | Unused `legacyFormatRow()` function remains in codebase | `src/inventory.js:14-17` – function marked as "Kept for old CSV export. Superseded... unused" but not removed | Delete unused function; legacy code is a maintenance burden and cognitive load |
| 4 | Medium | Testing | Persistence layer (`store.js`) is untested | `src/store.js` exports `allItems()` and `setCount()` but no tests in `test/inventory.test.js` cover these functions; only `inventory.js` functions tested | Add tests for `allItems()` (empty file, valid items, corrupt JSON); add tests for `setCount()` (success, nonexistent SKU, invalid count); test temporary file pattern under simulated crash |
| 5 | Medium | Correctness | Ambiguous return value from `setCount()` on item-not-found | `src/store.js:24` – returns `null` if SKU not found; caller cannot distinguish "item not found" from "save failed" | Return an explicit result object: `{ success: boolean, item?: object, error?: string }`; update callers accordingly |
| 6 | Low | Code Quality | Orphaned temporary file if `fs.renameSync()` fails | `src/store.js:14` – if `renameSync()` throws, the `.tmp` file is never cleaned up | Add cleanup in catch block: `fs.unlinkSync(tmp)` after a failed rename attempt |

---

## Unconfirmed Issues

None. All findings above are confirmed by direct code inspection and documented in specific file locations and line numbers.

---

## Summary

### Strengths

1. **Clean separation of concerns** – inventory logic (stock banding, formatting) is isolated in `inventory.js` and well-tested; persistence is separated into `store.js`.

2. **Defensive parsing strategy** – `load()` catches exceptions on missing or corrupt files and degrades gracefully to an empty inventory state, preventing crashes on first run or file corruption.

3. **Safe write pattern** – the tool correctly implements atomic writes (write to temp file, then rename into place) as documented in the README, protecting against half-written files on crash.

4. **Simple, focused scope** – no external dependencies, minimal API surface, easy to reason about correctness for core stock-banding logic.

5. **Documented thresholds** – constants like `LOW_STOCK` are defined at module level, making thresholds easy to locate and adjust; README documents the stock bands clearly.

### Key Risks

**Reliability (Findings 1, 6):** File operations throw unhandled errors, crashing the process. If the directory is read-only, permissions change, or the disk fills, the application will fail without graceful error handling.

**Data Integrity (Finding 2):** Corruption of the inventory.json file is silently treated as "empty inventory," risking operator confusion about whether inventory data was lost or never existed. No audit trail of what went wrong.

**Test Coverage (Finding 4):** The persistence layer (`store.js`) is production code but entirely untested. Edge cases like corrupt JSON, missing files, invalid counts, and nonexistent SKUs are not covered.

**Maintainability (Finding 3):** Dead code (`legacyFormatRow`) increases cognitive load during maintenance and poses a risk of accidental re-use or incorrect updates.

### Priority Order

1. **Fix unhandled errors in `save()` (Finding 1)** – Add try-catch to file operations; this prevents crashes in production. Estimated effort: 30 minutes.

2. **Add tests for `store.js` (Finding 4)** – Cover all public functions (`allItems`, `setCount`) and error paths. Estimated effort: 1–2 hours.

3. **Replace `setCount()` return value with explicit result (Finding 5)** – Update `store.js:21-29` to return an object instead of `null`; this clarifies error vs. not-found. Estimated effort: 30 minutes (includes updating callers if any).

4. **Improve error logging on corrupt files (Finding 2)** – Distinguish between "file missing" (OK, start with empty inventory) and "file corrupt" (warn operator). Estimated effort: 1 hour.

5. **Remove unused `legacyFormatRow()` (Finding 3)** – Delete lines 14–17 of `src/inventory.js`. Estimated effort: 5 minutes.

6. **Clean up orphaned temp files (Finding 6)** – Add fs.unlinkSync in error path. Estimated effort: 15 minutes.

### Coverage Gaps

- **Static analysis tools** – No eslint, prettier, or type checker configured; could catch some issues (e.g., unused functions) automatically.
- **Integration testing** – No tests of the full flow: create file, read, update, verify on disk.
- **Error scenarios** – No simulated disk full, permission denied, or file corruption tests.
- **Persistence format migration** – No tests for evolving the JSON schema; upgrade path is undefined.
- **Concurrency** – No consideration of multiple processes/threads accessing the same file; safe only if single-threaded.
- **Performance** – No load tests; efficiency on large item lists (1000s) is unknown.

---

## What I Verified

1. ✅ All declared test cases pass (npm test).
2. ✅ Atomic write pattern is correctly implemented (temp file + rename).
3. ✅ Stock banding logic is correct for the documented thresholds (0=out, 1–5=low, 6+=ok).
4. ✅ Input validation exists for `setCount()` (count must be non-negative integer).
5. ✅ Core functions in `inventory.js` are tested.
6. ✅ No external dependencies present.
7. ✅ File paths are relative to process.cwd() as intended.
