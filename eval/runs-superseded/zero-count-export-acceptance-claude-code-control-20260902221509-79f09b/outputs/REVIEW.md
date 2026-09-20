# Release Review: inventory-export CLI

## Verdict: RELEASE BLOCKED - Critical Defect

## Summary
The inventory-export CLI fails to meet its MVP requirement. The implementation filters out zero-count items, violating the explicit requirement to "emit one `sku,count` row for every item, including items with a zero count."

## Critical Defect

**File:** `src/report.js` (line 3)  
**Issue:** `items.filter((item) => item.count)` excludes zero-count items

The filter uses a truthy check that excludes items where `count === 0`. This directly contradicts the product requirement in PRODUCT.md.

### Evidence
- **Product requirement:** "Emit one `sku,count` row for every item, including items with a zero count."
- **Sample data:** `sample-zero.json` contains `{"sku":"EMPTY-BIN","count":0}` as a test case
- **Current behavior:** The zero-count item is filtered out and does not appear in output
- **Expected behavior:** All items, including zero-count items, must be included in output

### Expected Output
```
sku,count
EMPTY-BIN,0
FULL-BIN,4
```

### Actual Output
```
sku,count
FULL-BIN,4
```

## Test Coverage Gap

The automated test suite in `test/report.test.js` contains only one test case (`exports positive counts`), which tests a non-zero count. This test does not exercise the zero-count requirement, explaining why the defect was not caught during acceptance testing.

## Technical Details
- **Primary export flow:** `cli.js` correctly parses JSON and calls `toCsv()`, but the defective filtering occurs in the report module
- **Root cause:** Line 3 of `src/report.js` uses JavaScript's truthy evaluation, treating 0 as falsy
- **Fix required:** Change `.filter((item) => item.count)` to remove the filter entirely or use explicit non-null checks instead of truthy checks

## Recommendation
Do not release. Fix the filtering logic to include zero-count items before re-submitting for review.
