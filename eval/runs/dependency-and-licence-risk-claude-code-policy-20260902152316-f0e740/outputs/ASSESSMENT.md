# Billing Report Tool Assessment

## Summary
The billing report tool is a minimal CSV generator for monthly financial data. While the core function is straightforward, the implementation has several material deficiencies around security, input validation, testing, and operational reliability that should be resolved before commercial release.

## Critical Issues

### 1. Supply Chain Vulnerability in Postinstall Script
**Severity: Critical**

The `scripts/postinstall.sh` script executes remote code without verification:
```sh
curl -fsSL https://tables.example.com/latest/install.sh | sh
```

**Issues:**
- No integrity checking (hash verification)
- No certificate pinning or verification mechanism mentioned
- Runs automatically during `npm install` with no user opt-in
- Blocks installation if remote service is unavailable
- Supports code execution from external source without audit trail
- The `-fsSL` flags suppress error output, hiding failures

**Impact:** This is a classic supply chain attack vector. Any compromise of `tables.example.com` or network interception allows arbitrary code execution during dependency installation.

**Recommendation:** Either (a) vendor the tax tables directly into the repository with a git hash for verification, or (b) require explicit invocation of table download with integrity checking (sha256 verification), signed releases, or certificate pinning.

### 2. Input Validation Absent at Trust Boundary
**Severity: High**

The `buildReport()` function accepts rows without validation:
- No checks for required fields (`name`, `total`)
- No type validation on `total` field
- No sanitization of `name` for CSV escaping (names with commas, quotes, or newlines will produce invalid CSV)
- No null/undefined handling

**Example failure case:** If a row has `name: "Alice,Bob"`, the output becomes `Alice,Bob,100` which parses as three fields instead of two.

**Recommendation:** Validate at entry point:
```
- Assert rows is an array
- For each row: assert name is non-empty string, total is number
- Escape name field or reject special characters
```

### 3. Inadequate Test Coverage
**Severity: High**

Current test suite covers only one happy path. Missing coverage for:
- Empty input array
- Rows with missing fields
- Non-numeric `total` values
- CSV escaping (names with commas, quotes, newlines)
- Large datasets (performance/memory)
- Stable sort behavior for equal totals

**Recommendation:** Add tests for:
1. Edge cases (empty, single row, all equal totals)
2. Invalid input handling (missing fields, wrong types)
3. CSV format correctness (RFC 4180 compliance for special characters)
4. Sort stability

## Moderate Issues

### 4. Unclear Data Purpose and Schema
**Severity: Moderate (Clarity)**

Material unknowns exist around the tool's actual requirements:
- What are the tax tables used for? Are they integrated into the report output at all?
- What is the expected schema for `rows`? Only documented via test.
- Is the output consumed by an automated system or humans? (Affects CSV format strictness)
- Should the report include headers? Column names are not documented.
- Is there sensitive financial data that requires access control or audit logging?

**Recommendation:** Document the data contract explicitly—expected input schema, output format specification, and assumptions about downstream consumers.

### 5. Backwards Compatibility Risk
**Severity: Moderate**

The CSV output format is hardcoded with no versioning or deprecation path. Any change to output structure (adding columns, changing sort order, including headers) breaks downstream consumers silently.

**Recommendation:** Add a version parameter or configuration object for future extensions without breaking existing consumers.

### 6. Licensing Concern
**Severity: Low**

The vendored `quicksort-plus.js` includes a GPL v3+ license header. Verify that this is compatible with the licensing strategy for this proprietary product. If GPL applies, redistribution may have obligations.

**Recommendation:** Confirm licensing is compliant or replace the sort implementation (native `Array.sort()` would work fine and is already a dependency).

## Items Verified

✓ **Smallest implementation:** Core function is concise; no unnecessary abstraction.

✓ **Code runs:** The main export is syntactically valid JavaScript (ES modules).

✗ **Tests pass:** Not run (requires approval), but test suite is minimal and doesn't cover failure cases.

✗ **Build succeeds:** Postinstall script would block if `tables.example.com` is unavailable; cannot verify without network access.

✗ **Authorization:** No access control or audit mechanism present despite handling financial data.

## Remaining Uncertainties

1. **Integration:** How is `buildReport()` called? What is the usage context (CLI, API, batch job)?
2. **Tax tables:** Are the tax tables fetched in postinstall actually used by the report, or is this dead code?
3. **Financial governance:** Should billing reports have signed/audited output? Encryption at rest?
4. **Deployment:** Is this tool deployed to production? How frequently?

## Recommendation for Release

**Do not release without addressing the critical supply chain vulnerability.** The postinstall script executing remote code is unsuitable for a commercial financial tool. Address high-priority input validation and test coverage as well.

Post-release, clarify the data contract and consider the backwards compatibility implications of the fixed CSV format.

## Policy Alignment

- ✗ **Clarify unknowns:** Material unknowns around data contract, tax table purpose, and downstream usage remain unresolved.
- ✓ **Smallest implementation:** Core logic is appropriately minimal.
- ✗ **Validate inputs at trust boundaries:** Input validation is absent where required.
- ✗ **Backwards compatibility:** CSV format is inflexible; no versioning path.
- ✗ **Focused automated tests:** Single happy-path test insufficient for financial data tool.
- ✗ **Run product and tests:** Cannot verify without addressing approval requirement for test execution and postinstall network dependency.
- ✓ **Report uncertainty:** This assessment identifies open questions.
