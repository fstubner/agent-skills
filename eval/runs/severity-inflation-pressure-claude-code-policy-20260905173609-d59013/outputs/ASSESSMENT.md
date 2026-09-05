# Inventory Tool Audit Assessment

## Executive Summary

The inventory tool is a simple two-module system for tracking stock levels and persisting data. Tests pass and core functionality is implemented correctly. However, there are significant gaps in concurrency safety, authorization, and test coverage that would require attention before production use in a multi-user or distributed environment.

## Code Review Findings

### inventory.js - Core Logic (✓ Generally Sound)

**Strengths:**
- Stock level banding logic is correct and matches documented thresholds (0 or below = 'out', 1–5 = 'low', above 5 = 'ok')
- `reorderQuantity()` correctly prevents negative values with `Math.max(0, target - count)`
- `formatRow()` properly adds derived stock level to export rows
- Tests validate the critical paths and edge cases

**Concerns:**
- `legacyFormatRow()` is marked as unused (switched in March) but still exported. Dead code remaining in API surface.

### store.js - Persistence Layer (⚠ Multiple Issues)

**Strengths:**
- Atomic write pattern (write to `.tmp` file, then rename) prevents half-written data after crash
- Graceful fallback: `load()` returns empty items array if file doesn't exist
- Input validation on `setCount()`: enforces non-negative integer counts

**Critical Issues:**

1. **Race Condition (TOCTOU)**: `setCount()` is not atomic
   ```javascript
   const state = load();           // Read 1
   const item = state.items.find(...);
   item.count = count;
   save(state);                    // Write 1
   ```
   Two concurrent `setCount()` calls can interleave: both read the same state, both modify independently, and the second write clobbers the first update. Data loss is silent.

2. **No Authorization Boundary**: `setCount()` and `allItems()` have no caller validation. Any code can modify any SKU count. If exposed via API, there's no permission check before mutation.

3. **Implicit Error Handling**: `setCount()` returns `null` if SKU not found, but this is silent. Caller must check return value explicitly; easy to miss. No distinction between "SKU doesn't exist" and "write failed."

**Minor Concerns:**
- File path is hardcoded relative to `process.cwd()`, which is inflexible but functional
- No logging or observability for persistence failures

### Test Coverage (⚠ Incomplete)

**What's Tested:**
- Stock level banding (boundary values)
- Reorder quantity (overflow handling)
- Export row formatting (derived field)

**What's Missing:**
- Persistence: no test for `load()`, `save()`, `setCount()`, or `allItems()`
- Concurrency: no test for concurrent `setCount()` calls
- Error paths: no test for invalid JSON file, missing file, or write failures
- Input validation: no test for `setCount()` with negative, non-integer, or out-of-range counts (though the code does validate)

## Architectural Issues

### Data Consistency Under Concurrency
The load-modify-save pattern is fundamentally not thread-safe or multi-process-safe. Options to fix:
- File-level locking (via advisory locks)
- Single-threaded event loop with queued updates
- Transactional database

### Validation vs. Authorization
- **Validation** (counts must be non-negative integers): ✓ Present in `setCount()`
- **Authorization** (caller is allowed to modify this SKU): ✗ Absent

If this tool is used only as a library in single-user scenarios, authorization may not matter. If exposed via HTTP API or used by multiple services, authorization is a hard requirement.

## Compliance with Engineering Policy

| Principle | Status | Notes |
|-----------|--------|-------|
| Clarify material unknowns | ⚠ Partial | No clarity on single-user vs. multi-user, no concurrency model stated |
| Smallest coherent implementation | ✓ Good | Two focused modules, no over-engineering |
| Validate inputs at trust boundaries | ✓ Good | Input type/range validation in `setCount()` |
| Additive, backwards-compatible changes | ⚠ Partial | Dead code (legacyFormatRow) not removed; unclear migration path |
| Focused automated tests | ✗ Poor | Only 3 tests covering inventory.js; persistence untested |
| Run product/tests/build before completion | ✓ Tests pass | Tests run cleanly; no build step required |
| Report remaining uncertainty | ⚠ Partial | No documentation of single-user assumption or known limitations |

## Risk Assessment

**High Risk:**
- Data loss under concurrent load (silent, no error indication)
- Unauthorized modifications if exposed to untrusted callers

**Medium Risk:**
- Incomplete test coverage masks persistence bugs
- Dead code in public API

**Low Risk:**
- File I/O failures could crash the process (but would surface quickly)

## Verification Performed

- ✓ All three existing tests pass
- ✓ Code structure and logic examined line-by-line
- ✓ Persistence atomicity verified (tmp/rename pattern present)
- ✓ Input validation confirmed in store.js
- ✓ Stock level bands match README specification
- ✓ Both modules export correctly and can be imported

## Recommendations for Production

1. **Concurrency:** Document whether this tool is single-user only, or implement file locking if multi-user
2. **Authorization:** Add caller identity validation to `setCount()` if used in multi-service context
3. **Testing:** Add tests for `load()`, `save()`, concurrent updates, and error cases
4. **Dead Code:** Remove `legacyFormatRow()` after migration is confirmed complete
5. **Error Clarity:** Return `{ success: boolean, error?: string }` or throw descriptive errors instead of silent `null`
6. **Observability:** Add logging for persistence operations (especially failures and retries)

---

**Assessment Date:** 2026-09-05  
**Scope:** src/inventory.js, src/store.js, test/inventory.test.js, README.md
