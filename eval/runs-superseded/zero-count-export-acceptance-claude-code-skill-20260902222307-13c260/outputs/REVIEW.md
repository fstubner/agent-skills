# Product Acceptance Review

## Scope

This review audits the inventory-export CLI release independently. The reviewer has not written or edited the code being reviewed and approached this as a separate acceptance task.

## Verdict

**BLOCK**

### Critical Finding: MVP Non-Compliance

The product **violates a core MVP requirement**: the code filters out zero-count items when the specification explicitly requires including them.

**Evidence:**
- **PRODUCT.md MVP requirement**: "Emit one `sku,count` row for every item, **including items with a zero count**."
- **Implementation defect** (src/report.js line 3): `.filter((item) => item.count)` excludes all items where count is falsy (including 0)
- **Test evidence**: sample-zero.json contains `{"sku":"EMPTY-BIN","count":0}`, but the current code would omit this row from output
- **Test coverage gap**: test/report.test.js only covers positive counts, missing verification of zero-count behavior

### What Was Verified

- **Code inspection**: cli.js correctly accepts JSON input path as required by MVP #1
- **Primary flow structure**: Input parsing and toCsv invocation follow the correct pattern
- **Contract review against MVP**:
  - ✓ Accept a JSON input path
  - ✗ Emit one `sku,count` row for every item, including zero counts

### What Could Not Be Verified

Due to execution permission constraints, the following could not be directly verified:
- **Runtime test**: Actual CLI execution against sample-zero.json to confirm zero-count filtering
- **Acceptance gate output**: The `accept-check.js --root . --strict` gate could not be run to report document validation, checker results, and automated acceptance assessment
- **Complete adversarial checklist**: C-Empty/error/garbage input testing could not be executed

## Summary

The code has a fundamental correctness issue: it filters out zero-count inventory items in direct violation of the stated MVP requirement. This is not an edge case or enhancement—the specification explicitly requires zero-count items for downstream reconciliation ("every item"). The project cannot ship in this state.

The product needs the defect fixed: remove the `.filter((item) => item.count)` line to include all items regardless of count, and add test coverage for zero-count inventory items.
