# Inventory Tool Audit

## Summary

The inventory tool is a minimal two-module system for managing item stock counts with CSV export. Tests pass. The code is readable and enforces basic constraints, but lacks clarity on several architectural decisions, has incomplete input validation at trust boundaries, and insufficient test coverage for critical persistence logic.

---

## Strengths

1. **Atomic file operations**: The `save()` function uses temp file + rename pattern, preventing half-written files on crash.
2. **Basic validation**: `setCount()` validates that count is a non-negative integer before mutation.
3. **Test coverage for core logic**: The three inventory functions (`stockLevel`, `reorderQuantity`, `formatRow`) are tested against their documented thresholds.
4. **Clear module separation**: `inventory.js` handles business logic; `store.js` handles persistence. Simple and coherent.

---

## Issues & Gaps

### 1. **Incomplete Input Validation at Trust Boundaries**

- `stockLevel(count)` and `reorderQuantity(count, target)` do not validate inputs. Callers can pass `null`, `undefined`, strings, or objects, producing unexpected behavior (e.g., `stockLevel("banana")` returns `'ok'` due to JavaScript coercion).
- `formatRow(item)` assumes the item object has `sku`, `name`, and `count` properties but doesn't validate structure. Missing or mistyped properties silently produce malformed CSV rows.
- **Risk**: Silent data corruption or confusing output if bad data flows in.

### 2. **Silent Error Handling in `load()`**

The `load()` function catches any exception and returns `{ items: [] }`. This masks:
- File corruption (invalid JSON)
- Permission errors
- Disk failures
- Missing parent directories

**Risk**: Operators cannot distinguish between "no inventory yet" and "inventory file is corrupted" or "permission denied."

### 3. **No Concurrency Safety**

If multiple processes call `setCount()` concurrently:
1. Process A reads inventory (gets state with item count = 10)
2. Process B reads inventory (gets same state)
3. Process A writes count = 15, saves
4. Process B writes count = 12, saves (overwrites A's change)

Process A's change is lost. There is no file locking or version checking.

**Risk**: Data loss under concurrent load.

### 4. **Unclear Semantics for Unknown SKU**

`setCount(sku, count)` returns `null` if the SKU doesn't exist. This behavior is not documented in the function or in comments. It's also asymmetric: the function updates existing items but cannot create new ones. This forces external callers to manage the "does this SKU exist?" check themselves.

**Risk**: Silent no-ops that callers may not expect.

### 5. **Dead Code Not Removed**

The `legacyFormatRow()` function is explicitly marked as "Kept for the old CSV export. Superseded by formatRow below; the export was switched over in March and this is unused." 

Per the engineering policy baseline: avoid backwards-compatibility hacks and re-exports of obsolete code. If the March switchover is complete, this function should be deleted, not kept with a comment.

**Risk**: Maintenance burden; confusion about whether it's still in use.

### 6. **Insufficient Test Coverage for Persistence**

Tests cover the three public functions in `inventory.js`, but `store.js` (the critical data layer) has zero test coverage:
- No test for `allItems()` behavior on missing file, corrupted JSON, or empty inventory.
- No test for `setCount()` persistence (does the write actually happen? is the data readable after?).
- No test for concurrent or rapid sequential calls to `setCount()`.
- No test for error cases in `setCount()` when validation fails.

**Risk**: Persistence bugs are discovered in production.

### 7. **Path Hardcoding**

The inventory file is stored at `./.data/inventory.json` relative to `process.cwd()`. This assumes the tool is always run from a specific directory. If the working directory changes, the tool silently reads/writes different files or creates new ones.

**Risk**: Confusion and data loss when tool is invoked from unexpected locations.

### 8. **No Bounds on Count Values**

`setCount()` validates that count is a non-negative integer but does not enforce an upper bound. Astronomically large counts (e.g., `Number.MAX_SAFE_INTEGER`) may cause issues in downstream systems expecting reasonable inventory numbers.

**Risk**: Garbage data accepted silently.

### 9. **Hardcoded Stock Threshold**

`LOW_STOCK` is a constant. If different clients need different thresholds (e.g., critical items vs. bulk items), this architecture cannot support it. Clients cannot customize the threshold without modifying source code.

**Risk**: Inflexible design limits reuse.

### 10. **Incomplete Feature Set**

The tool can only update counts for existing items; there is no API to add new items to the inventory. The `allItems()` function is exported but `add()` or `createItem()` is not. This suggests either incomplete implementation or implicit expectation that inventory is bootstrapped externally.

**Risk**: Unclear how the tool is meant to be used in a real system.

---

## Material Unknowns

1. **How is the initial inventory loaded?** The tool assumes items already exist in the JSON file. How do new items get added?
2. **Is this tool single-threaded or multi-process?** Concurrency behavior is untested and likely unsafe.
3. **What are the actual stock thresholds for this business?** Are "low" at 1–5 items correct for all products?
4. **Should `setCount()` throw or return null on unknown SKU?** Current implicit behavior is ambiguous.
5. **Who owns the `.data` directory?** Are there permission constraints or shared-storage concerns?

---

## Test Results

All existing tests pass:
```
✔ stock levels are banded at the documented thresholds
✔ reorder quantity never goes negative
✔ an exported row carries the derived stock level
```

---

## Recommendations (Not Implemented)

To address the policy baseline:

1. **Validate inputs at trust boundaries**: Add checks in `stockLevel()`, `reorderQuantity()`, and `formatRow()`.
2. **Clarify error cases**: Make `load()` distinguish between "no file" and "corrupt file"; document `setCount()` null return or change to throw.
3. **Add persistence tests**: Write tests for `store.js` covering success, missing file, invalid JSON, and basic persistence.
4. **Remove dead code**: Delete `legacyFormatRow()` if the March switchover is truly complete.
5. **Document or resolve unknowns**: Add a "Usage" section to README clarifying how items are initialized, whether concurrency is supported, etc.
6. **Consider a factory or configuration**: Allow callers to specify inventory path and stock thresholds instead of hardcoding.
7. **Add an `addItem()` function** (if needed) or clearly document that external systems are responsible for bootstrapping inventory.

---

## Verification Summary

- Code runs and tests pass without errors.
- Architecture is simple and separation of concerns is clear.
- File I/O uses safe atomic operations (temp + rename).
- Input validation is present at the data layer (`setCount()`) but absent from business logic functions.
- Persistence layer is untested and has potential concurrency issues.
- Dead code is documented but not removed.
- Several design decisions (error handling, SKU creation, path handling) lack clarity.
