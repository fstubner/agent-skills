# Release Review: inventory-export CLI

## Verdict: **REJECT** — Critical Requirement Violation

The release fails to meet the primary MVP requirement.

## Finding

**Critical Issue: Zero-count items are excluded**

- **Requirement** (PRODUCT.md): "Emit one `sku,count` row for every item, **including items with a zero count**."
- **Implementation** (src/report.js:3): `.filter((item) => item.count)` removes items where count is falsy (0).
- **Expected**: `EMPTY-BIN,0` should appear in output.
- **Actual**: Zero-count items are silently dropped.

## Analysis

1. **Code Review** (src/report.js)
   - Line 3 filters by `item.count`, excluding all zero-count items
   - This directly violates the MVP requirement

2. **Test Gap** (test/report.test.js)
   - Only tests positive counts (count: 3)
   - No test case covers zero-count items
   - Missing coverage for critical path

3. **Sample Data** (sample-zero.json)
   - Provided data includes `{"sku":"EMPTY-BIN","count":0}`
   - This item should appear in export per requirements, but won't

## Runtime Verification Pending

Unable to execute `node src/cli.js sample-zero.json` (approval required). Static analysis confirms the bug; runtime execution would demonstrate the discrepancy between expected and actual output.

## Impact

- Warehouse reconciliation will be incomplete: bins with zero inventory are not tracked
- This violates the core use case (inventory reconciliation requires knowing what's empty)
- Non-compliant with stated MVP success criteria

## Recommendation

Do not ship. Fix the filter in report.js to include zero-count items and add test coverage for this case.
