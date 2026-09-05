# Inventory Tool Audit Assessment

## Overview
Audited two modules: `src/inventory.js` (stock level classification and row formatting) and `src/store.js` (file persistence). All tests pass.

## Verified Functionality

### inventory.js
- **Stock level banding**: Correctly implements specification (0 or below = 'out', 1-5 = 'low', above 5 = 'ok')
- **Reorder quantity calculation**: Correctly computes `target - count` with a floor of 0 to prevent negative values
- **Row formatting**: Includes SKU, name, count, and derived stock level in CSV format
- **Legacy code**: Correctly marked as superseded; `legacyFormatRow` is unused after March export switch

### store.js
- **Atomic writes**: Uses temp file + rename pattern to prevent half-written files on crash
- **Load safety**: Gracefully handles missing or corrupted JSON files by returning empty state `{ items: [] }`
- **Validation**: `setCount` validates count is a non-negative integer before persisting
- **Item lookup**: Correctly finds items by SKU in the state array

## Issues Identified

### High Priority
1. **CSV format injection vulnerability**: `formatRow` does not escape commas or newlines in item names. An item named "Bolt, Washer" would produce malformed CSV: `A1,Bolt, Washer,5,low` (ambiguous column count).

2. **No item CRUD operations**: `store.js` only provides `setCount` for updating counts. No functions to add items, remove items, or modify item properties (name, SKU). The system relies on externally created inventory files.

3. **Race condition on concurrent writes**: Multiple processes calling `setCount` simultaneously could interleave reads and writes, causing data loss. Atomic write protects individual operations, but not read-modify-write cycles. Process A and B both read, modify different items, then write sequentially—B's write overwrites A's changes.

### Medium Priority
4. **Path handling**: Uses `process.cwd()` to construct the data file path. This creates unpredictable storage location depending on caller's working directory. Relative paths can differ between CLI invocation, test environment, and production deployment.

5. **No schema validation on load**: `JSON.parse` succeeds for any JSON object shape. Loading a file missing the `items` array, or with items lacking `sku`, `name`, or `count` fields, would silently cause errors downstream.

6. **Unused legacy code**: `legacyFormatRow` exports an unused function (superseded 6+ months ago). Ideally removed to reduce API surface and maintenance burden.

### Low Priority
7. **No error metadata in load exception handling**: The catch block swallows the error silently. Callers cannot distinguish between "file missing" vs. "file corrupted" for debugging or recovery strategies.

## Test Coverage
Tests verify the core logic paths (stock level thresholds, reorder calculations, row format) and pass successfully. Tests do not cover:
- CSV injection with special characters
- Concurrent `setCount` calls
- Invalid item data in loaded state
- File system errors (permissions, disk full)

## Compatibility Notes
- `src/inventory.js` is well-designed for its scope: pure functions with no side effects
- Exported functions match documented behavior from `README.md` exactly
- No backwards-incompatible changes detected

## Summary
The inventory tool correctly implements stock level classification and single-operation updates to a JSON-backed store. Primary concerns are: (1) CSV format lacks escaping for special characters, (2) concurrent writes can lose data, (3) limited CRUD operations, and (4) unpredictable file storage location. These are design constraints rather than bugs in the current implementation.
