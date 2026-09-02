# Inventory Tool Audit Assessment

## Summary
The inventory tool provides stock level tracking and count management across two modules: `inventory.js` for business logic and `store.js` for persistence. The code is generally well-structured and implements atomic writes, but has several correctness and robustness issues.

## Verified Functionality

### inventory.js
- **stockLevel()**: Correctly bands stock into three levels:
  - 'out' for count ≤ 0
  - 'low' for count 1–5
  - 'ok' for count > 5
  - Matches documented behavior in README
  
- **reorderQuantity()**: Returns difference between target and current count, never negative
  - Tested: reorderQuantity(2, 10) = 8, reorderQuantity(12, 10) = 0 ✓
  
- **formatRow()**: Correctly formats CSV row including derived stock level
  - Tested: formatRow({sku: 'A1', name: 'Bolt', count: 3}) = 'A1,Bolt,3,low' ✓
  
- **legacyFormatRow()**: Present but unused; correctly formats old row structure for backward reference

### store.js
- **Atomic writes**: Uses temp file + rename pattern correctly (line 12–14) to prevent partial writes on crash
- **load()**: Gracefully falls back to empty inventory if file missing or corrupted
- **setCount()**: Validates count is non-negative integer; returns updated item or null if not found

## Issues Identified

### 1. **Negative Count Validation Gap** (Medium Severity)
- **Location**: `reorderQuantity()` in inventory.js
- **Issue**: Function accepts negative count values without validation. Example: `reorderQuantity(-5, 10)` returns 15 instead of 10.
- **Impact**: Incorrect reorder calculations if negative counts somehow reach this function (should not occur in normal flow due to setCount validation, but creates an inconsistency)
- **Expected**: Should either validate input or document the assumption that count is always non-negative

### 2. **Inconsistent Error Handling** (Medium Severity)
- **Location**: `setCount()` in store.js
- **Issue**: Throws TypeError for invalid count, but returns null when item not found (line 25). This inconsistency requires caller to check both error handling patterns.
- **Impact**: Callers must handle exception and null return separately; unclear failure modes
- **Expected**: Should either throw consistently or return structured error/success object

### 3. **Race Condition in Concurrent Writes** (High Severity)
- **Location**: `setCount()` in store.js, lines 6–14
- **Issue**: Load-modify-save pattern is not atomic. If two processes call setCount concurrently, one update can be lost:
  1. Process A loads state
  2. Process B loads state (same data)
  3. Process A modifies item X and saves
  4. Process B modifies item Y and saves (overwrites A's changes to X)
- **Impact**: Data loss in concurrent environments; silent failure with no warning
- **Expected**: Use file locking, transactions, or a database if concurrent writes are possible

### 4. **Missing Input Validation in formatRow** (Low Severity)
- **Location**: `formatRow()` in inventory.js, line 20
- **Issue**: Does not validate that item has required properties (sku, name, count). Missing properties produce malformed CSV.
- **Impact**: Produces invalid output if item object is incomplete
- **Expected**: Should validate structure or document the invariant that item is guaranteed valid

### 5. **Silent Error Swallowing** (Low Severity)
- **Location**: `load()` in store.js, line 7
- **Issue**: Catches all exceptions and returns default empty inventory. File permission errors, corrupted JSON, and I/O failures are silently hidden.
- **Impact**: Makes debugging difficult; operator cannot distinguish "no inventory yet" from "file is corrupted"
- **Expected**: Could log errors or re-throw permission/corruption errors while only swallowing "file not found"

## Testing Coverage

Tests verify:
- ✓ Stock level banding at exact boundaries (0, 5, 6)
- ✓ Negative stock input handling (returns 'out')
- ✓ Reorder quantity never negative
- ✓ CSV row formatting with stock level

**Not tested**:
- Concurrent setCount calls
- Invalid item objects in formatRow
- File corruption recovery
- Item not found behavior in setCount

## Code Quality

- **Strengths**: Clear function names, atomic write pattern, good separation of concerns
- **Weaknesses**: Sparse error handling, inconsistent validation, comment about unused legacyFormatRow is informative but function could be removed
