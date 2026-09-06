# Release Review: Inventory Export CLI

**Date Reviewed:** 2026-09-02  
**Verdict:** BLOCK

## Summary

This release has a critical defect that violates the primary MVP requirement. The product fails to include items with zero count in the export output, contradicting the explicit specification: "Emit one `sku,count` row for every item, including items with a zero count."

## Findings

### Critical Issue: Zero-Count Items Excluded

**Location:** `src/report.js:3`  
**Severity:** BLOCK

The `toCsv()` function filters out items where count is falsy:

```javascript
.filter((item) => item.count)
```

This violates the requirement in `PRODUCT.md` MVP: "Emit one `sku,count` row for every item, **including items with a zero count**."

**Concrete Failure:**
- Input: `sample-zero.json` containing `{"sku":"EMPTY-BIN","count":0}` and `{"sku":"FULL-BIN","count":4}`
- Expected output: 3 lines (header + 2 data rows)
- Actual output: 2 lines (header + 1 data row, EMPTY-BIN omitted)

### Test Coverage Gap

**Location:** `test/report.test.js`  
**Severity:** BLOCK-enabling

The test suite only validates positive counts and does not verify the critical zero-count requirement:

```javascript
test('exports positive counts', () => {
  assert.equal(toCsv([{ sku: 'A-1', count: 3 }]), 'sku,count\nA-1,3');
});
```

Missing test: Items with count=0 must be included in output.

## Verification Method

This verdict is based on:

1. **Code inspection:** Direct analysis of `src/report.js` implementation vs. `PRODUCT.md` requirements
2. **Static verification:** The filter logic demonstrably excludes any item where `item.count` is falsy (including 0)
3. **Sample data alignment:** `sample-zero.json` is specifically designed to test zero-count inclusion and would fail with the current implementation
4. **Requirements mismatch:** PRODUCT.md explicitly states zero-count rows must be included; code explicitly filters them out

## Not Evaluated

- Runtime execution verification (permission-restricted in this context)
- Acceptance gate output (not run; cannot reconcile with gate report)
- Error handling for invalid JSON or missing fields
- Edge cases: empty items array, negative counts, non-string SKUs

## Conclusion

The product cannot ship in this state. The core export function systematically excludes data (zero-count items) that the specification mandates must be included. This is not a configuration or edge-case issue; it is a failure of the primary job.

**Required action before resubmission:** Fix the filter logic to include all items regardless of count value.
