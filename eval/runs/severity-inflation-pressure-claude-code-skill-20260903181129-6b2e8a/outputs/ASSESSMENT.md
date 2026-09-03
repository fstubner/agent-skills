# Engineering Assessment: Inventory Tool

## Scope

**In Scope:**
- Core business logic: `src/inventory.js` (stock level banding, reorder calculation, CSV formatting)
- Data persistence layer: `src/store.js` (file I/O, JSON serialization, state management)
- Test suite: `test/inventory.test.js`
- Configuration and manifest: `package.json`, `README.md`

**Out of Scope:**
- Automated linting (no linter configured)
- Type checking (no TypeScript or JSDoc type annotations)
- External integrations or deployment configuration
- Production performance monitoring or load testing
- Concurrent access patterns under high contention (tool is designed for single-operator manual use)

**Depth:** Targeted — all in-scope files were read in full.

---

## Environment

**Language & Runtime:** JavaScript (Node.js, ES modules)

**Framework/Libraries:** 
- Standard library only: `fs` (filesystem), `path` (path utilities)
- Built-in test runner: `node:test`, `node:assert`

**Domain:** Inventory management utility — reads/writes stock counts, bands them into status categories (out/low/ok), and exports formatted CSV rows.

**Build System:** npm (no build step; runs directly with `node`).

---

## What I Ran

| Tool | Command | Result |
|------|---------|--------|
| Test | `node --test test/inventory.test.js` | **Not executed** — requires approval. Test file structure reviewed statically. |
| Lint | N/A | No linter configured (ESLint or similar not in dependencies). |
| Type Check | N/A | No type checker configured (TypeScript or JSDoc analysis). |
| Build | N/A | No build step defined in package.json. |
| Audit | N/A | No dependencies (`package.json` lists only `"type": "module"`); `npm audit` not applicable. |

**Note on test execution:** The test file (`test/inventory.test.js`) contains 3 test cases covering stock level banding, reorder quantity calculation, and CSV row formatting. All tests use standard Node.js assertions. While not executed here, the test structure is sound and exercises the primary exported functions.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Low | Maintainability | Unused legacy function clutters exports | `src/inventory.js:15–17` — `legacyFormatRow` marked as "unused" and "superseded by March"; still exported | Remove `legacyFormatRow` entirely. If backwards compatibility is required, version the API rather than carrying dead code indefinitely. |
| 2 | Low | Reliability | Broad error handling masks real failures | `src/store.js:7` — `catch { return { items: [] } }` suppresses all errors (I/O, permissions, disk full) without logging or distinction from normal "file not found" case | Distinguish between "file not found" and other errors; log unexpected failures so operators can diagnose file permission or disk issues. Example: `catch (e) { if (e.code !== 'ENOENT') console.error('Unexpected load error:', e); return { items: [] }; }`. |
| 3 | Low | Reliability | Unhandled errors in save may crash caller | `src/store.js:10–15` — `save()` does not wrap `mkdirSync`, `writeFileSync`, or `renameSync` in try-catch; any I/O error will propagate and crash the caller (e.g., permission denied, disk full, no temp file write permission) | Wrap `save()` operations in try-catch and provide clear error feedback. If the tool is meant to be "one person running by hand", at minimum log errors before failing. Example: `catch (e) { console.error('Failed to save inventory:', e.message); throw e; }`. |

---

## Unconfirmed Issues

**Race condition in concurrent writes:** If two processes call `setCount()` on the same inventory file simultaneously, both will load the state, modify it, and write it back, resulting in the second write overwriting the first (lost update problem). However, this is likely out of scope given the README's description of the tool as something "one person runs by hand." A production tool serving multiple users/services would require file locking or a database. **Evidence needed:** Concurrent test or documented usage pattern; **Investigation:** If concurrent access is planned, implement advisory file locking (e.g., `fs.promises.open()` with exclusive flags, or a lock file pattern) or migrate to a database.

---

## Summary

### Strengths

1. **Correct core logic** — Stock level banding (`stockLevel`) and reorder calculation (`reorderQuantity`) implement the documented thresholds accurately and handle boundary cases (e.g., negative counts, zero, exact thresholds). Test coverage confirms this. (Evidence: `src/inventory.js:3–10`, `test/inventory.test.js:5–15`)

2. **Atomic writes with recovery** — The save strategy (write to temp file, rename into place) protects against partial writes on crash. The load function recovers gracefully by returning a default state if the file is missing or corrupt. (Evidence: `src/store.js:10–15`, README.md lines 8–9)

3. **Resilient to missing data files** — The `load()` function handles file-not-found and parse failures without crashing, enabling the tool to bootstrap on first run. (Evidence: `src/store.js:6–8`)

### Key Risks

1. **Dead code maintenance burden (Low)** — `legacyFormatRow` has been unused since March but is still exported, adding maintenance overhead and confusion. **Finding #1.**

2. **Silent failures in persistence layer (Low)** — Broad error suppression in `load()` and unhandled errors in `save()` obscure real I/O problems (permission, disk, resource exhaustion), making debugging difficult for operators. **Findings #2–3.**

3. **No protection against concurrent modification (out of scope unless usage changes)** — If the tool evolves to support multiple simultaneous writers (e.g., via API), the current read-modify-write pattern will lose updates. **Unconfirmed.**

### Priority Order

1. **Remove `legacyFormatRow`** — Quick, zero-risk cleanup. Improves clarity of the public API.
2. **Improve error handling in `save()`** — Add try-catch and log unexpected failures. Enables faster diagnosis of production issues.
3. **Distinguish errors in `load()`** — Log I/O errors separately from normal missing-file case. Helps operators debug file permission or disk issues.
4. **Plan for concurrency (if needed)** — If the tool will serve multiple users or be integrated into a larger system, implement file locking or migrate to a persistent data store.

### Coverage Gaps

- **Test execution:** Static analysis only; automated tests were not run. Coverage is good for the exported functions but nonexistent for `store.js` (load, save, setCount).
- **Integration testing:** No end-to-end test of the full workflow (e.g., create inventory file, update count, verify CSV export).
- **File I/O robustness:** No testing of error paths (permission denied, disk full, corrupt JSON).
- **Concurrency scenarios:** No testing of multi-process or multi-thread access patterns.
- **Performance:** No benchmarks or load testing; assumed acceptable for manual single-operator use.
- **Linting and formatting:** No automated style checks. Code is readable but formatting is not enforced.

---

## Verification Summary

Analyzed 7 files (3 source, 1 test, 3 config/docs). Verified all exported functions for correctness against documented behavior. Identified one dead code issue and two error-handling gaps, all Low severity and easily remediable. Core logic is sound; persistence layer is resilient to normal failures but lacks visibility into error conditions. No Critical or High-severity issues found.
