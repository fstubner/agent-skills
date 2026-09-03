# Inventory Tool Audit Assessment

## Overview
The inventory tool consists of two modules: `src/inventory.js` (business logic) and `src/store.js` (persistence layer). The codebase is minimal and includes basic test coverage.

## Findings

### Critical Issues

1. **Race Condition in `setCount()` (store.js:21-29)**
   - The operation is not atomic: `load()` → `find()` → `modify` → `save()`. Concurrent calls from multiple processes/threads can cause lost updates.
   - Example: Two processes each load, modify different fields, and save—one update is lost.
   - This is a classic TOCTOU (time-of-check-time-of-use) bug that could cause data loss in production.

2. **Silent Error Suppression (store.js:7)**
   - `load()` catches all errors silently and returns `{ items: [] }`. This masks real errors like file permission issues, disk corruption, or invalid JSON.
   - A corrupted file would silently reset to an empty inventory instead of alerting the user.

### High Priority Issues

3. **No Input Validation for Loaded Data (store.js:6-8)**
   - The JSON structure is never validated after parsing. Malformed or unexpected data structures could cause runtime errors downstream.
   - No checks for required fields (`items` array) or item structure (required `sku`, `name`, `count` properties).

4. **Inconsistent Error Handling (store.js:21-29)**
   - `setCount()` returns `null` when SKU is not found instead of throwing an error. This forces callers to check for `null`, inconsistent with the explicit `TypeError` for invalid count values.
   - Callers may forget null checks, silently ignoring failures.

5. **Missing Input Type Validation (inventory.js:3-6)**
   - `stockLevel()` doesn't validate that `count` is a number. Non-numeric inputs could produce unexpected results.
   - Accepts negative numbers without explicit documentation (though behavior is defined).

### Medium Priority Issues

6. **Unused Dead Code (inventory.js:15-17)**
   - `legacyFormatRow()` is explicitly marked as superseded and unused. Keeping it creates maintenance burden and confusion.
   - Should be removed unless there's a strong backward-compatibility requirement.

7. **No Locking Mechanism (store.js)**
   - Multiple processes writing to the same file have no coordination. While atomic writes prevent partial corruption, concurrent reads and writes can still produce stale-read scenarios.
   - No file locking, semaphore, or database transaction mechanism.

8. **Insufficient Test Coverage (test/inventory.test.js)**
   - Tests only cover `inventory.js` functions, not the persistence layer (`store.js`).
   - No tests for error cases, malformed data, or concurrent access scenarios.
   - No integration tests verifying the full read-modify-write cycle.

### Low Priority Issues

9. **No Logging or Diagnostics (store.js)**
   - Silent failures in `load()` and no visibility into what went wrong. Difficult to debug issues in production.

10. **Hardcoded File Path (store.js:4)**
    - File path is fixed at `.data/inventory.json` relative to current working directory. Not configurable for different deployments or testing scenarios.

11. **String-Based Stock Status (inventory.js:3-6)**
    - Stock levels are returned as strings (`'out'`, `'low'`, `'ok'`). Constants or enums would be safer and prevent typos.

## Recommendations

### Must Fix
- Implement file-level locking or use a proper database to prevent race conditions
- Replace silent catch block with explicit error handling and logging
- Add schema validation for loaded JSON data
- Make `setCount()` error handling consistent (throw instead of returning null)

### Should Fix
- Add input validation to `stockLevel()` 
- Remove `legacyFormatRow()` if truly unused
- Expand test coverage to include store operations and error cases
- Add logging for debugging

### Could Improve
- Make file path configurable
- Use constants/enums for stock level strings
- Add documentation about thread-safety and concurrent access limitations

## Verified Aspects

✓ Stock level banding works correctly at documented thresholds (0/below=out, 1-5=low, 6+=ok)
✓ Reorder quantity calculation prevents negative values
✓ Export row formatting includes derived stock level
✓ File write atomicity via temp file and atomic rename
✓ Directory creation for file storage works
✓ Count validation rejects non-integers and negative values
