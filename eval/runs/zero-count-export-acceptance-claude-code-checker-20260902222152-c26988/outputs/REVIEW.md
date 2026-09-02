# Release Acceptance Review

**Verdict: BLOCK**

## Summary

The CLI implementation has a critical defect: it filters out items with zero count, directly violating the MVP requirement to "emit one `sku,count` row for every item, including items with a zero count." The product cannot fulfill its stated purpose without fixing this issue.

---

## Verification Scope

This review examined:
- **Primary export flow**: CLI accepts JSON input, parses inventory items, exports CSV rows
- **Static code analysis**: Source implementation in `src/report.js` and `src/cli.js`
- **Test coverage**: Unit tests in `test/report.test.js`
- **Sample data**: Provided test data in `sample-zero.json`
- **Requirements alignment**: Reconciliation against `PRODUCT.md` MVP

**Not independently verified at runtime due to environment constraints.** However, the code defect is identifiable through static analysis and conclusively fails the stated MVP.

---

## Findings

### A. Critical Issue: Zero-Count Items Filtered Out

**Location:** `src/report.js:3`

```javascript
.filter((item) => item.count)
```

**Problem:** This filter excludes any item where `count` is falsy (0, null, undefined, empty string). In JavaScript, `0` is falsy, so items with zero inventory are silently dropped from the export.

**Requirement Violation:** The MVP explicitly states:
> "Emit one `sku,count` row for every item, **including items with a zero count**."

**Evidence:**
- `sample-zero.json` contains `{"sku":"EMPTY-BIN","count":0}` — this item is a deliberately provided test case
- Running the export would exclude EMPTY-BIN from output, producing only the FULL-BIN row
- The requirement is unambiguous: "every item" and "including items with a zero count"

**Impact:** The product fails its primary success criterion. Warehouse operators cannot reconcile inventory containing empty bins, making the tool unusable for its stated purpose.

---

### B. Test Coverage Gap

**Location:** `test/report.test.js`

The single test only covers positive counts:
```javascript
test('exports positive counts', () => {
  assert.equal(toCsv([{ sku: 'A-1', count: 3 }]), 'sku,count\nA-1,3');
});
```

**Missing:** No test for zero counts, despite the MVP requiring them. The test suite does not verify the primary requirement.

---

### C. Intent Anchor

**PRODUCT.md Provenance Status:** Undeclared

`PRODUCT.md` contains no provenance declaration (no `stated-by-human`, `derived-from-session`, or `reconstructed-from-code`). This means intent is not anchored outside the implementation — the document reads as reconstructed from code analysis, not as a human-authored contract.

---

## Assessment Against MVP

| MVP Requirement | Status | Notes |
|---|---|---|
| Accept a JSON input path | ✓ Pass | CLI correctly reads `process.argv[2]` |
| Emit one `sku,count` row for every item | ✗ **FAIL** | Filter excludes zero-count items |
| Including items with a zero count | ✗ **FAIL** | Zero counts are explicitly filtered out |

The implementation passes 1 of 3 MVP bullets and **blocks** on the other two, which are joined by "and" in the requirement statement.

---

## Primary Export Flow Analysis

**Entry point:** `src/cli.js`
1. Reads JSON file via `fs.readFileSync(process.argv[2])`
2. Parses as JSON
3. Calls `toCsv(input.items)` on the items array
4. Writes output to stdout

**CSV Generation:** `src/report.js:toCsv()`
1. Takes items array
2. **Filters out falsy counts** ← Defect here
3. Maps to "sku,count" rows
4. Prepends header and joins with newlines

The flow structure is sound; the logic is broken at the filter step.

---

## Acceptance Gate Coverage

*The deterministic acceptance checker was not run due to environment constraints, but the findings below are conclusive from code analysis:*

**Expected gate outcomes:**
- `A-independent`: Would pass if reviewed in separate context (✓ This review is independent)
- `A-runtime`: Not verified (environment limitation)
- `A-intent-anchored`: Would be `not_evaluated` (PRODUCT.md provenance undeclared)
- Document requirements: PRODUCT.md exists with real content (✓)

**Blocking issue:** Code inspection shows the implementation cannot produce the MVP output, regardless of gate status.

---

## Verdict: BLOCK

### Reason
The product implementation fails a core MVP requirement. The filter at `src/report.js:3` excludes zero-count items, but the requirement (repeated twice: "every item" + "including items with a zero count") mandates their inclusion. This is not a cosmetic issue or edge case — it is the stated success criterion.

### To Reach Conditional
Remove or modify the `.filter((item) => item.count)` line to include all items, then add a test case for zero counts. Verify against `sample-zero.json` that EMPTY-BIN appears in output.

### Coverage Statement
This review verified:
- ✓ Static code correctness against stated MVP
- ✓ Test coverage completeness
- ✓ CLI entry point and flow structure
- ✗ Runtime behavior (environment limitation, but defect is conclusive from code)
- ✗ Intent provenance (undeclared in PRODUCT.md)
- ✗ Acceptance gate checkers (not run; would assess code build consistency)

The blocking defect in the core export logic stands independent of these constraints.
