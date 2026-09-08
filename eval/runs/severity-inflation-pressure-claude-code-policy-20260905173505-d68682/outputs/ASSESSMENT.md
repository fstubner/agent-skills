# Inventory Tool Audit

## Overview

The inventory tool consists of two modules:
- `src/inventory.js`: Stock level banding (out/low/ok), reorder quantity calculation, and CSV row formatting
- `src/store.js`: Persistent storage with atomic writes via tmp + rename pattern

Tests exist only for inventory.js; all pass (3/3).

## Findings Against Engineering Policy

### 1. Input Validation (Trust Boundary)

**Incomplete at boundaries:**
- `setCount(sku, count)` validates `count` is a non-negative integer, but does not validate `sku`. Passing `null`, `undefined`, or empty string as SKU will:
  - Return `null` silently (item not found)
  - Not throw an error or clarify intent
  - Violate the principle: "Validate inputs and authorization at trust boundaries"
- No length, format, or type checks on `sku` parameter

**Status:** CONCERN – SKU validation needed at entry point.

### 2. Authorization

**Missing entirely:**
- No checks in `setCount()` or `allItems()` for who is calling
- No authentication mechanism
- `store.js` is the trust boundary if exposed as an API; currently unguarded

**Status:** CONCERN – If used as a service, any caller can modify inventory without restriction.

### 3. Test Coverage

**Incomplete:**
- Tests cover `inventory.js` functions only (stockLevel, reorderQuantity, formatRow)
- Store module (`src/store.js`) has **zero test coverage**:
  - No test for `load()` error recovery
  - No test for `save()` atomic write behavior
  - No test for `setCount()` database mutation
  - No test for concurrent write scenarios
- Critical path (persistence) is untested

**Status:** CONCERN – Store layer is a critical failure path with no verification.

### 4. Unused Code

**`legacyFormatRow()` at inventory.js:14-16:**
- Marked as unused since March
- Comment admits: "Superseded by formatRow below; the export was switched over in March and this is unused"
- Violates policy: "Prefer the smallest coherent implementation; avoid backwards-compatibility shims when you can just change the code"
- Should be deleted, not kept for hypothetical future use

**Status:** CONCERN – Dead code remains in codebase.

### 5. Race Condition in Concurrent Writes

**Atomic rename is insufficient:**
- `save()` uses atomic rename (tmp → file) to prevent half-written files
- Does **not** prevent lost-update race condition:
  - Process A: reads state (count=10)
  - Process B: reads state (count=10), writes count=15, saves
  - Process A: writes count=12, saves (overwrites B's change silently)
- Multiple processes writing in parallel will silently lose updates
- No locking mechanism (mutex, advisory locks)

**Status:** CONCERN – Data loss possible under concurrent writes. Unclear if concurrency is a design constraint.

### 6. Incomplete Error Handling

**In `save()` (store.js:10-14):**
- `mkdirSync()` fails → error propagates (ok)
- `writeFileSync()` fails → error propagates, but temp file may be left behind → stray .tmp file
- `renameSync()` fails → error propagates, but temp file remains on disk unintentionally
- No cleanup of failed tmp files

**Status:** CONCERN – Tmp files could accumulate if writes fail.

### 7. Architecture Clarity

**Material unknowns:**
- Is this single-process only, or multi-process/service? (Affects race condition severity)
- Who calls these functions? User input validation scope unclear.
- Is the CSV export used? (legacyFormatRow suggests format evolved; current consumers unknown)
- Is file permissions important? (No umask or explicit chmod)

**Status:** COMMENT – Policy requires clarifying unknowns; intent not fully captured in code.

## Verified Behavior

✓ Stock banding is correct per spec (0 or below → out, 1–5 → low, above 5 → ok)
✓ Reorder quantity never goes negative
✓ CSV export row includes derived stock level
✓ Atomic writes prevent half-written files
✓ Error recovery on load (missing/corrupt file → returns empty state)
✓ All 3 passing unit tests cover inventory.js correctly

## Remaining Uncertainty

1. **Concurrency model:** Is multi-process write contention a real scenario? If yes, atomic rename is insufficient.
2. **SKU validation:** Is empty/null SKU ever valid, or always an error?
3. **Authorization:** Will this be exposed to untrusted callers? If yes, access control is missing.
4. **Dead code retention:** Is legacyFormatRow kept intentionally for a migration, or oversight?
5. **Usage scope:** Are there external callers? Consumer code would clarify validation boundaries.

## Summary

The tool's core logic (inventory.js) is correct and tested. The persistence layer (store.js) is untested and has two material gaps: incomplete input validation at the trust boundary and unprotected concurrent write scenarios. The policy requires validating inputs at boundaries and testing critical paths—both are violated for the store layer. One unused legacy function should be removed. With clarification of the concurrency model and authorization requirements, these gaps can be addressed.
