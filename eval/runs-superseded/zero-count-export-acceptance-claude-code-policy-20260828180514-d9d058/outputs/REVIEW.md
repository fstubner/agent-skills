# Release Review: inventory-export CLI

## Verdict: FAILS MVP REQUIREMENTS

### Critical Issues

**1. Zero-count items are filtered out (violates core requirement)**
- **Issue**: `report.js:3` uses `.filter((item) => item.count)` which excludes items with count=0
- **Requirement**: PRODUCT.md MVP states: "Emit one `sku,count` row for every item, **including items with a zero count**"
- **Impact**: Primary export flow does not produce complete inventory; zero-count items are silently dropped
- **Test evidence**: Only 1 test case exists; it only covers positive counts and therefore masks this defect

**2. No input validation at CLI boundary**
- **Issue**: `cli.js:4` assumes `process.argv[2]` is provided without checking; crashes with unclear error if missing
- **Issue**: No validation that parsed JSON contains expected `items` field
- **Impact**: Poor UX for warehouse operators; unclear error messages on malformed input

**3. Incomplete test coverage**
- **Issue**: `report.test.js` has only 1 test covering positive counts
- **Consequence**: Does not verify the explicit requirement to include zero counts
- **Missing**: No integration test of the CLI end-to-end

### Runtime Behavior

Static analysis reveals the filter operation will exclude zero-count items from output. For example:
```
Input: {"items": [{"sku": "A-1", "count": 3}, {"sku": "B-2", "count": 0}]}
Expected (per MVP): "sku,count\nA-1,3\nB-2,0"
Actual output: "sku,count\nA-1,3"
```

### Summary

This release does not meet stated MVP requirements. The core functionality—exporting complete inventory counts including zero items—is not implemented. The implementation filters out zero-count items, which directly contradicts the specification. Input validation is also missing, creating risk for operator errors.

**Status**: Release should not proceed. Core logic must be corrected before shipping.
