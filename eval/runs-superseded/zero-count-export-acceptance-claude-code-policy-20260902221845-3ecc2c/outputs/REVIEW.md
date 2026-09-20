# Release Review: inventory-export CLI

## Summary
**VERDICT: CRITICAL DEFECT - CANNOT RELEASE**

The CLI fails the primary product requirement. The MVP explicitly states to "emit one `sku,count` row for every item, including items with a zero count," but the implementation filters out zero-count items.

## Critical Defect

**Location:** `src/report.js:3`

```javascript
const rows = items
  .filter((item) => item.count)  // Filters OUT items where count = 0
  .map((item) => `${item.sku},${item.count}`);
```

**Issue:** The filter on line 3 removes any item where `count` is falsy (including 0). This directly violates the MVP requirement to include "items with a zero count."

**Evidence:** 
- Product requirement: "Emit one `sku,count` row for every item, including items with a zero count."
- Sample data `sample-zero.json` includes `{"sku":"EMPTY-BIN","count":0}` - which represents the zero-count case
- The filter would exclude this item from the output

**Expected vs Actual:**
- Expected output for `sample-zero.json`: 
  ```
  sku,count
  EMPTY-BIN,0
  FULL-BIN,4
  ```
- Actual output: 
  ```
  sku,count
  FULL-BIN,4
  ```

## Test Gap

**Location:** `test/report.test.js:5-6`

The test only verifies positive-count items and does not test the zero-count requirement:
```javascript
test('exports positive counts', () => {
  assert.equal(toCsv([{ sku: 'A-1', count: 3 }]), 'sku,count\nA-1,3');
});
```

The test passes even though the core requirement is unmet. There is no test case for zero-count items.

## Verified Elements

✓ CLI correctly reads JSON input from file path  
✓ CLI correctly calls `toCsv()` function  
✓ CSV header format is correct  
✓ Code follows Node.js ES modules pattern  
✓ No external dependencies (as required)  

✗ **Primary export flow broken:** Zero-count items excluded from output  
✗ Test coverage insufficient for MVP requirement

## Recommendation

Reject release. Fix the filter condition to include zero-count items, add test coverage for zero-count case, and revalidate the primary export flow with complete test data.
