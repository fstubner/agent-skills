# Inventory Tool Audit

## Code Review

### inventory.js
- **stockLevel(count)**: Correctly implements the documented stock bands
  - Returns 'out' for count ≤ 0
  - Returns 'low' for 1 ≤ count ≤ 5
  - Returns 'ok' for count > 5
  - Properly handles negative values and edge cases

- **reorderQuantity(count, target)**: Correctly calculates reorder quantity
  - Computes target − current count
  - Uses Math.max(0, ...) to ensure result never goes negative
  - Handles all input combinations appropriately

- **legacyFormatRow(item)**: Marked as unused and kept for legacy compatibility
  - Outputs 3 fields: sku, name, count
  - Correctly noted as superseded by formatRow

- **formatRow(item)**: New export format
  - Outputs 4 fields: sku, name, count, stock level
  - Derives stock level dynamically using stockLevel()
  - Correctly includes the status in the export row

### store.js
- **load()**: Robust file reading
  - Safely handles missing or corrupt JSON files (returns default empty state)
  - Uses try/catch to gracefully degrade

- **save(state)**: Uses atomic write pattern
  - Creates directory structure as needed
  - Writes to temporary file first, then renames into place
  - Prevents partial/corrupt writes if process crashes during save
  - Follows best practices for file persistence

- **allItems()**: Simple retrieval of all items
  - Delegates to load() which handles errors
  - Returns empty array if no items exist

- **setCount(sku, count)**: Updates item count
  - Validates input: count must be non-negative integer (uses Number.isInteger)
  - Throws TypeError on invalid input (appropriate for application logic)
  - Returns null if SKU not found (correct signal for "not found")
  - Properly loads state, modifies, and persists

## Verification Points

✓ Stock level thresholds match documented specification (0-or-below: 'out', 1-5: 'low', >5: 'ok')
✓ Reorder quantity calculation prevents negative values
✓ Export row format includes derived stock level
✓ Input validation: count must be non-negative integer
✓ Atomic file writes prevent corruption from mid-write crashes
✓ Graceful handling of missing/corrupt inventory.json file
✓ Error handling via exceptions is appropriate for internal state validation
✓ No security vulnerabilities (JSON-based, no injection risks, safe path operations)
✓ Test suite passes all documented cases
✓ Legacy code properly marked and preserved

## Summary

The inventory tool is correctly implemented per specification. Stock level banding, reorder calculations, export formatting, and file persistence all work as documented. Input validation is strict and appropriate. The atomic write pattern provides robustness against process crashes. All test cases pass, including edge cases for negative counts and reorder calculations.
