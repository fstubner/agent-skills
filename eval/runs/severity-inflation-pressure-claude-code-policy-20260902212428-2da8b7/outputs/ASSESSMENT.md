# Inventory Tool Audit

## Overview
The inventory tool consists of two modules: `inventory.js` (stock level classification and formatting) and `store.js` (persistence layer). It classifies items into stock bands and exports formatted rows, with atomic writes to prevent corrupted state on crash.

## Engineering Policy Alignment

### ✓ Input Validation at Trust Boundaries
- **Good:** `setCount()` validates that count is a non-negative integer before applying state changes (line 22, store.js)
- **Good:** Stock level thresholds are documented and implemented correctly

### ⚠ Material Unknowns Not Fully Clarified
- **Question:** No SKU validation exists. What format/constraints are SKUs expected to follow? The `setCount()` function silently returns `null` if SKU not found, but there's no guard preventing invalid SKU formats from being queried
- **Question:** The store returns a default empty state on JSON parse failure (line 7, store.js) without logging or signaling the failure. Should callers know the data was unreadable?
- **Question:** No authorization checks exist. Is this tool assumed to run in a trusted environment, or should access be restricted?

### ✓ Minimal Coherent Implementation
- Small focused functions with single responsibilities
- Stock level banding is simple and testable
- Reorder quantity correctly constrains to non-negative range

### ✓ Atomic Writes for Safety
- Uses temp-file-then-rename pattern to ensure atomicity (lines 12-14, store.js)
- Directories created recursively to handle new deployments

### ⚠ Critical Behavior Not Fully Tested
- **Gap:** No tests for `store.js` (persistence layer). Functions `setCount()` and `allItems()` are untested
  - No verification that data persists across restarts
  - No verification that atomicity actually prevents corruption under concurrent access
  - No test for the error-handling path (parse failure returning empty state)
- **Gap:** Tests don't cover `legacyFormatRow()` which is marked as superseded but still present
- **Gap:** No test for negative count rejection in `setCount()`

### ⚠ Legacy Code Management
- `legacyFormatRow()` is marked as unused (line 14, inventory.js) but remains in codebase
- No deprecation notice, version marker, or timeline for removal
- Code comment indicates transition "in March" but no date context given
- Should either delete if unused or document the removal plan

### ✓ Data Model Sound
- Stock bands clearly defined in README: out (≤0), low (1-5), ok (>5)
- CSV export includes derived state (stock level) alongside raw count, supporting downstream reporting

### ⚠ Filesystem Assumptions
- Hard-coded path `.data/inventory.json` relative to `process.cwd()` - assumes specific working directory
- No validation that path is writable before attempting save
- No handling for disk full, permission denied, or other filesystem errors beyond parse failure

### ✓ Backwards Compatibility
- Changes to CSV format were handled via separate functions (`legacyFormatRow` vs `formatRow`)
- Current implementation can read existing data without breaking

## Summary of Concerns

1. **Untested store layer** - No tests for the persistence functions that handle data durability and atomicity
2. **Incomplete error handling** - Silent failures on filesystem errors (except parse), no logging
3. **Dead code** - `legacyFormatRow()` should be removed or have explicit retention plan
4. **Missing SKU validation** - No specification of what constitutes a valid SKU
5. **Implicit authorization model** - No indication of whether access control is expected upstream

## What Was Verified

✓ Stock level banding logic correct per documentation  
✓ Reorder quantity constraint implementation  
✓ CSV export format includes stock status  
✓ Atomic write pattern present (temp + rename)  
✓ Input type validation for count parameter  
✓ Core functions have basic test coverage (inventory.js)  
