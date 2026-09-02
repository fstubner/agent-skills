# Inventory Tool Code Audit

## Overview
The inventory tool consists of two modules: `src/inventory.js` handles stock level categorization and row formatting, while `src/store.js` manages reading and writing inventory data to persistent storage.

## Code Quality Assessment

### src/inventory.js

**Function: `stockLevel(count)`**
- **Correctness**: ✓ Correctly implements documented stock bands
  - Returns `'out'` for counts ≤ 0
  - Returns `'low'` for counts 1-5
  - Returns `'ok'` for counts > 5
- **Implementation**: Simple and efficient; uses early returns

**Function: `reorderQuantity(count, target)`**
- **Correctness**: ✓ Correctly calculates reorder amounts
  - Uses `Math.max(0, target - count)` to ensure non-negative results
  - Handles case where current count exceeds target

**Function: `formatRow(item)`**
- **Correctness**: ✓ Properly formats inventory rows
  - Includes all required fields: SKU, name, count, and computed stock level
  - Integrates `stockLevel()` to derive stock band inline

**Function: `legacyFormatRow(item)` (Deprecated)**
- Status: Marked as unused; superseded by `formatRow()` since March
- Note: Code comment indicates it's retained for reference but no longer called

### src/store.js

**Function: `load()`**
- **Correctness**: ✓ Gracefully handles missing or invalid files
  - Try-catch block prevents crashes when file doesn't exist or is malformed
  - Returns safe default `{ items: [] }` on any error
  - Properly specifies UTF-8 encoding

**Function: `save(state)`**
- **Correctness**: ✓ Implements atomic file writes as documented
  - Creates directory structure recursively
  - Writes to temporary file first
  - Uses atomic rename to prevent partial writes on crash
  - Design aligns with stated requirement: "crash mid-write cannot leave a half-written file"

**Function: `setCount(sku, count)`**
- **Input Validation**: ✓ Enforces data integrity
  - Validates count is a non-negative integer
  - Throws `TypeError` with clear message for invalid inputs
- **Logic**: ✓ Correctly updates inventory
  - Loads current state
  - Finds item by SKU
  - Returns `null` if item not found (appropriate sentinel)
  - Updates count and persists changes
  - Returns updated item for confirmation

**Function: `allItems()`**
- **Correctness**: ✓ Simple accessor that delegates to `load()`
  - Returns items array from current state
- **Behavior**: Returns empty array if file missing/corrupted (inherits from `load()`)

## Test Coverage

**Covered**:
- Stock level banding boundaries (0, -3, 5, 6)
- Reorder quantity with various count/target combinations
- Formatted row generation with stock level

**Not covered**:
- `store.js` module (no tests present)
- Error handling paths
- Edge cases for file I/O operations
- `setCount()` functionality (validation, updates, persistence)
- `allItems()` functionality

## Observations and Considerations

1. **Atomic Write Protection**: The temporary-file-then-rename pattern in `save()` is a reliable approach to prevent data corruption from interrupted writes.

2. **Silent Error Handling**: When file loading fails, the system returns a default value rather than propagating the error. This makes the system resilient but could mask issues silently. Callers have no way to distinguish between "file doesn't exist yet" and "file exists but is corrupted."

3. **Race Condition Potential**: The load-then-modify-then-save pattern in `setCount()` is not atomic at the application level. Concurrent calls from multiple processes could result in lost updates if two processes load the same state simultaneously before either saves their changes.

4. **Input Validation**: `setCount()` properly validates that count is a non-negative integer, but `save()` does not validate the state structure before serialization.

5. **Documentation Accuracy**: Code comments and README documentation match implementation behavior for stock bands and file safety mechanisms.

## Verified
- Stock level banding logic matches documented thresholds
- Reorder quantity calculation prevents negative values
- Formatted row includes required fields and computed stock level
- Atomic file write mechanism prevents half-written files via temporary file + rename pattern
- Input validation in `setCount()` enforces integer and non-negativity constraints
- Error handling in file load gracefully returns default state
