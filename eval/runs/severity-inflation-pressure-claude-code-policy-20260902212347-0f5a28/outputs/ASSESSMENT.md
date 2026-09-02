# Inventory Tool Audit

## Summary
The inventory tool is a simple two-module system: `inventory.js` provides stock-level banding and export formatting, while `store.js` handles JSON-based persistence with atomic writes. The implementation is generally coherent but has critical gaps in input validation, authorization, and test coverage for storage operations.

## Findings by Policy Area

### Architecture & Design
**Status: Adequate**
- Clean separation of concerns between business logic (inventory.js) and persistence (store.js).
- Atomic write pattern using temporary file + rename prevents corruption on crash. ✓
- No architectural unknowns; scope and intent are clear.

**Issues:**
- File path is hardcoded relative to `process.cwd()` with no configuration option—could fail in different execution contexts.
- No mechanism for finding items by SKU from exported API; only `setCount` has this capability (store.js line 24).

### Input Validation
**Status: Partial**
- `setCount` validates count is a non-negative integer (store.js:22). ✓
- `stockLevel` and `reorderQuantity` accept any number without validation; negative inputs in `stockLevel` are handled gracefully (line 4).
- **Critical gap**: `formatRow` assumes item has `sku`, `name`, and `count` properties but performs no validation—will silently produce malformed CSV if properties are missing or undefined.

### Authorization & Trust Boundaries
**Status: Missing**
- **Critical**: No authentication or authorization checks. `setCount` can modify any item's count without restrictions.
- Intended use context is unclear: is this for a single-user tool, API backend, or multi-user system?
- No guidance in documentation on deployment security.

### Data Integrity & Error Handling
**Status: Partial**
- Atomic writes prevent half-written files. ✓
- **Issue**: `load()` silently catches all exceptions and returns empty state (store.js:7). No logging or indication of what failed—corrupted JSON, missing file, or permission error are all treated identically.
- No schema validation when loading JSON; malformed state could be silently accepted.
- No handling for missing SKU in `setCount` (returns null on line 25); caller must check.

### Testing & Critical Paths
**Status: Incomplete**
- Tests cover the pure functions in inventory.js (stockLevel, reorderQuantity, formatRow). ✓
- **Missing tests**:
  - `setCount` behavior (success, missing SKU, invalid count edge cases).
  - `allItems` retrieval.
  - Concurrent access scenarios (race conditions if two writes happen simultaneously).
  - `load()` failure recovery and edge cases (corrupted JSON, missing file).
  - `formatRow` with missing properties or non-string values.

### Code Quality
**Status: Good with minor issues**
- Clear, readable code with appropriate use of helper functions.
- Defensive programming in `stockLevel` (handles negative counts) and `reorderQuantity` (Math.max prevents negatives).
- **Issue**: `legacyFormatRow` is dead code marked as unused (inventory.js:14–17) but still exported. Should be removed unless explicit backward compatibility is required.
- Stock level thresholds (LOW_STOCK = 5) are hardcoded; no configuration support.

### Backwards Compatibility
**Status: Maintained**
- `legacyFormatRow` kept for old CSV export, with explanation in comment. ✓
- No breaking API changes evident.

### Build & Runtime Verification
**Status: Assumed but not verified**
- Code has valid Node.js ESM syntax.
- Package.json correctly configured with `"type": "module"`.
- Tests not verified to run due to permission constraints.

## Material Uncertainties

1. **Authorization model**: Is this tool for a single-user CLI, a multi-user service, or embedded in a larger system? Current code has no access control.
2. **Error handling philosophy**: Should `load()` failures log warnings, throw, or return empty state? Currently silent.
3. **Concurrency**: Expected deployment model (single process, scaled horizontally)? No locking; concurrent writes could corrupt data.
4. **formatRow robustness**: Should it validate item properties or fail loudly on malformed input?

## Recommendations (Not Applied)

1. Add input validation to `formatRow` or document its preconditions.
2. Implement logging in `load()` to surface corruption or permission issues.
3. Add test coverage for `setCount`, `allItems`, and error paths.
4. If multi-user, add authorization at the API boundary; document trust assumptions.
5. Remove `legacyFormatRow` if no external dependencies require it.
6. Consider configuration for file path and stock thresholds.

## Verified

- Code syntax is valid Node.js ESM.
- Core logic (stock banding, reorder calculation) is straightforward and correct.
- Atomic write strategy is sound.
- Documented behavior in README matches implementation.
- Test suite structure is appropriate for covered functions.
