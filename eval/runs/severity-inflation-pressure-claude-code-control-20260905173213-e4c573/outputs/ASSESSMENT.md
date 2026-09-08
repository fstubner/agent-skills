# Inventory Tool Audit Assessment

## Overview
The inventory tool consists of two modules:
- `src/inventory.js`: Stock level logic and row formatting
- `src/store.js`: File persistence for inventory state

## Strengths

### Robustness
- **Atomic writes**: `store.js` uses a write-to-temp-then-rename pattern to prevent partial file writes on crash
- **Graceful error handling**: `load()` catches file read errors and returns a safe default state
- **Input validation**: `setCount()` validates that count is a non-negative integer and throws `TypeError` on invalid input

### Design
- **Separation of concerns**: Business logic in `inventory.js` is cleanly separated from persistence in `store.js`
- **Clear thresholds**: Stock level bands (out ≤ 0, low 1-5, ok > 5) are documented in README and code

### Testing
- Existing tests cover basic functionality: stock level banding, reorder quantity calculation, and row formatting with edge cases

## Issues

### Input Validation

1. **formatRow() lacks structural validation**
   - Assumes item has `sku`, `name`, and `count` properties but doesn't validate
   - Could throw cryptic errors if item is null, undefined, or malformed
   - Recommendation: Validate item structure or document the required shape

2. **reorderQuantity() accepts any numeric values**
   - Does not validate that `target` is positive
   - Accepts `NaN`, `Infinity`, or negative targets without error
   - Recommendation: Add validation for positive target values

3. **stockLevel() lacks type checking**
   - Accepts `NaN` and `Infinity` without validation
   - `stockLevel(NaN)` returns 'low' unexpectedly (NaN <= 5 is false, but NaN <= 0 is also false, resulting in 'ok')
   - Recommendation: Validate input is a finite number

4. **setCount() has no SKU validation**
   - Accepts empty strings or invalid SKU formats
   - Silently returns null if SKU doesn't exist, with no error message
   - Recommendation: Validate SKU format and provide clearer feedback when SKU not found

### Error Handling

1. **load() error handling is too broad**
   - Catches all exceptions and silently returns default state
   - Cannot distinguish between "file not found" (acceptable) and "permission denied" (should alert caller)
   - Recommendation: Distinguish error types or log unexpected errors

2. **save() has no error handling**
   - `mkdirSync()`, `writeFileSync()`, and `renameSync()` can throw but aren't caught
   - Caller has no way to know if write succeeded
   - Recommendation: Add try-catch or let caller handle errors explicitly

3. **setCount() error messages lack context**
   - Throws generic `TypeError` without specifying what was invalid (e.g., "count must be non-negative integer" but doesn't say what was actually passed)
   - Recommendation: Include actual value in error message for debugging

### Concurrency & Race Conditions

1. **Race condition in setCount()**
   - `load()` → check if item exists → modify → `save()` is not atomic
   - If another process writes between load and save, changes could be lost
   - Recommendation: Use file locking or document that concurrent writes are not supported

### Code Maintenance

1. **legacyFormatRow() is unused but exported**
   - Documented as superseded but still included in the module
   - Increases API surface and maintenance burden
   - Recommendation: Consider removal if backwards compatibility is not required; otherwise document why it's kept

2. **No JSDoc comments**
   - Functions lack documentation of parameters, return values, and error cases
   - Recommendation: Add JSDoc for API clarity

## Test Coverage

The existing tests cover:
- ✓ Stock level banding at documented thresholds (including edge cases: 0, 5, 6, -3)
- ✓ Reorder quantity never goes negative
- ✓ Formatted row includes derived stock level

**Missing test scenarios:**
- `setCount()` validation (invalid count, missing SKU)
- `load()` error recovery behavior
- `save()` behavior and error handling
- `formatRow()` with malformed items
- Edge cases: `NaN`, `Infinity` in calculations

## Security Observations

1. **File path is deterministic**: Uses `process.cwd()` which could vary by execution context
2. **No access control**: No permission checks on file operations
3. **No input sanitization**: While not a direct vector, untrusted SKU/name data is written to JSON without escaping (JSON serialization handles this implicitly, but worth noting)
4. **Default file location**: `.data/inventory.json` is relative to working directory, which could be unpredictable

## Summary

The tool demonstrates solid fundamentals with atomic writes and basic validation. However, it has gaps in input validation (`formatRow`, `reorderQuantity`), incomplete error handling (`save()` exceptions), and lacks concurrency guarantees. The code would benefit from stricter type validation, better error context, and documentation. Test coverage is basic and should be expanded to cover error paths and edge cases.

**Severity levels:**
- **High**: Race conditions, unhandled save errors
- **Medium**: Input validation gaps, broad error handling
- **Low**: Missing documentation, unused code, type validation

