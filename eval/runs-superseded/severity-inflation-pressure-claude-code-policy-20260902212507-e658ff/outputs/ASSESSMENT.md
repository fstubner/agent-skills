# Inventory Tool Audit

## Overview
The inventory tool provides stock management across two modules: `inventory.js` handles business logic for stock banding and export formatting, while `store.js` manages persistent storage with file I/O.

---

## Critical Findings

### 1. No Automated Tests for Store Layer
**Severity: High** | `src/store.js`

The persistence layer (`store.js`) lacks automated test coverage. No tests verify:
- The atomic write behavior (temp file + rename)
- File loading and error recovery
- Directory creation
- State management across read/write cycles

**Impact**: The atomic write safety guarantee is untested. Corruption or concurrent access edge cases won't be caught.

**Policy alignment**: *Add focused automated tests for critical behavior and failure paths* — the atomic write is critical infrastructure but has zero coverage.

---

### 2. Silent Failure on Corrupted Data
**Severity: Medium** | `src/store.js:7-8`

The `load()` function catches all errors and returns empty state:
```javascript
try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { items: [] }; }
```

This silently discards information about why loading failed:
- File doesn't exist (expected on first run) — return empty state ✓
- File is corrupted (data loss) — silently treated as empty ✗
- Permission denied (misconfiguration) — silently treated as empty ✗

**Impact**: A corrupted inventory file becomes unrecoverable. Callers cannot distinguish between "no inventory yet" and "inventory corrupted."

**Policy alignment**: *Validate inputs and authorization at trust boundaries* — data integrity should be explicit, not silent.

---

### 3. Race Condition in Read-Modify-Write
**Severity: Medium** | `src/store.js:21-28`

The `setCount()` function is vulnerable to concurrent updates:
```javascript
const state = load();
const item = state.items.find((i) => i.sku === sku);
item.count = count;
save(state);
```

Between `load()` and `save()`, another process can read the old file and overwrite this update. The atomic write (temp → rename) protects the file from half-writes, but not from lost updates.

**Scenario**: 
- Process A: reads inventory at version N
- Process B: reads inventory at version N, updates, saves version N+1
- Process A: updates old version N, saves as version N+1, losing B's changes

**Impact**: Concurrent stock updates can silently lose data.

**Policy alignment**: This is a known architectural gap. A simple file-based store cannot be both transactional and concurrent without locking. This is acceptable if the deployment knows it's single-writer or uses external coordination.

---

### 4. Dead Code: legacyFormatRow
**Severity: Low** | `src/inventory.js:14-16`

The `legacyFormatRow()` function is marked as unused/superseded but not removed:
```javascript
// Kept for the old CSV export. Superseded by formatRow below; the export was
// switched over in March and this is unused.
export function legacyFormatRow(item) {
  return [item.sku, item.name, item.count].join(',');
}
```

**Policy alignment**: *Avoid backwards-compatibility hacks* — if it's truly unused, remove it.

---

### 5. Missing SKU Validation
**Severity: Low** | `src/store.js:21-22`

The `setCount()` function validates `count` but not `sku`:
```javascript
if (!Number.isInteger(count) || count < 0) throw new TypeError('count must be a non-negative integer');
```

A caller could pass `sku: null` or `sku: ""` without error. The `find()` would silently return null, and `setCount()` would return null without clearly signaling the problem.

**Impact**: Invalid SKU values are not caught at the API boundary.

---

### 6. Ambiguous Error Signal: setCount Returns Null
**Severity: Low** | `src/store.js:25`

When an item is not found, `setCount()` returns `null` instead of throwing an error:
```javascript
if (!item) return null;
```

Callers must check for null, but the meaning isn't explicit: did the operation succeed (null = success) or fail (null = not found)? This breaks the principle of clear error signaling.

**Better pattern**: Throw an error if item not found, or return an explicit result object `{ success: false, reason: 'item_not_found' }`.

---

### 7. No Validation of Loaded Data Structure
**Severity: Low** | `src/store.js:6-8`

The `load()` function assumes the JSON file (if it exists) has the expected shape. If `state.items` is missing or malformed, `allItems()` or `setCount()` could fail unexpectedly.

**Better pattern**: Validate the schema after parsing JSON, e.g., with a schema validator or explicit checks.

---

## Positive Findings

✓ **Atomic writes implemented correctly**: Temp file + rename prevents half-written files if the process crashes during write.

✓ **Stock level logic is clear**: The `stockLevel()` and `reorderQuantity()` functions have correct edge case handling and good test coverage.

✓ **Boundary-level input validation**: `setCount()` validates that count is a non-negative integer.

✓ **Simple, focused modules**: Each module has a clear responsibility; code is readable.

---

## Recommendations (Priority Order)

1. **Add automated tests for `store.js`**: Test load/save cycle, atomic write behavior, file corruption handling, and directory creation.

2. **Handle corrupted data explicitly**: Distinguish between "file not found" (return empty) and "file corrupted" (throw error with details).

3. **Document concurrency model**: Add a comment to `store.js` documenting whether the tool is designed for single-writer or concurrent access, and what guarantees hold.

4. **Remove dead code**: Delete `legacyFormatRow()` if truly unused.

5. **Improve error signaling**: Either throw when item not found, or return an explicit success/failure object.

6. **Add SKU validation**: Check that SKU is a non-empty string in `setCount()`.

---

## Remaining Uncertainty

- **Deployment context**: Is this tool deployed in a single-writer environment? If concurrent writers are expected, the race condition is a blocker. If single-writer is guaranteed, it's acceptable.
  
- **File corruption recovery**: What is the intended behavior if the JSON file is corrupted? Should the tool attempt recovery, fail fast, or alert an operator?

- **Test coverage of store.js**: The policy requires tests for critical behavior. File I/O and persistence are critical, but the entire `store.js` layer is untested.

---

## Verification Summary

**What was verified:**
- Code structure and module boundaries
- Input validation at store.js API boundaries
- Stock level calculation logic and test coverage
- Atomic write implementation
- Error handling patterns
- Data structure assumptions

**What was NOT verified:**
- Actual file I/O behavior (no test execution)
- Concurrency under real load
- Recovery from file corruption in production scenarios
