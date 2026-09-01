# Billing Report Tool — Engineering Assessment

**Assessment Date**: September 1, 2026  
**Depth**: Targeted (all in-scope files read in full)  
**Scope**: All source, test, and configuration files in the repository

---

## Scope

### In Scope
- **Source code**: `src/report.js` (main entry point)
- **Vendored dependencies**: `vendor/quicksort-plus.js` (in-house sort helper)
- **Tests**: `test/report.test.js`
- **Configuration**: `package.json`, `scripts/postinstall.sh`
- **Documentation**: `README.md`

### Out of Scope
- Runtime integration testing with external tax tables service
- Performance testing under production data volumes
- Deployment configuration or production environment state
- Third-party dependency vulnerability scanning (no external npm dependencies)
- Code review of tax calculation algorithms (outside the scope of this tool's responsibility)

### Depth
**Targeted** — every file in the in-scope list was read in full. Automated checks were attempted but could not run due to permission constraints (see "What I Ran" section).

---

## Environment

**Language & Runtime**: JavaScript (Node.js ES modules, v18+)  
**Frameworks & Libraries**: None (only Node.js built-ins used in tests)  
**Domain**: Finance/Billing — builds monthly billing CSV for the finance team  
**Build System**: None (pure JavaScript, no compilation needed)  
**Test Framework**: Node.js built-in `test` module  

---

## What I Ran

The following commands were attempted to gather automated evidence:

| Command | Status | Notes |
|---------|--------|-------|
| `node --test test/report.test.js` | Not executed | Requires runtime execution approval; could not be run. |
| `npm audit` | Not available | No external npm dependencies declared in package.json. |
| `eslint .` | Not available | No ESLint configuration or linter installed. |
| Type checking | Not applicable | JavaScript; no TypeScript or JSDoc-based type checking configured. |

**Impact**: The assessment relies entirely on source code review. Test execution was not possible, so test results are not included as evidence (noted as a coverage gap below).

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Code execution via pipe to shell in npm postinstall | `scripts/postinstall.sh:4` — `curl -fsSL https://tables.example.com/latest/install.sh \| sh` | Replace pipe-to-shell pattern with a dedicated npm package that downloads and validates the tax tables, or use `curl` to save to a file, validate the hash, and execute conditionally. Never pipe untrusted network streams to `sh`. |
| 2 | **Critical** | Compliance | GPL v3-licensed code vendored in proprietary project | `vendor/quicksort-plus.js:1-9` declares GPL v3; `package.json:4` declares project as UNLICENSED and private | Either: (a) replace with a properly-licensed sort implementation, (b) relicense the entire project under GPL v3 (making it open-source), or (c) use a built-in sort (e.g., `Array.sort()`) with a custom comparator. Do not ship GPL code in a proprietary product. |
| 3 | **High** | Reliability | Insufficient input validation allows undefined output | `src/report.js:4` — no validation that rows exist or contain `name` and `total` properties | Validate input before processing: check that rows is an array, and each row has non-null/non-undefined `name` and numeric `total` fields. Return error or empty string on invalid input rather than silently including "undefined". |
| 4 | **High** | Correctness | Type coercion risk in numeric sort | `vendor/quicksort-plus.js:11` — sorts using `a[key] > b[key]` without type checks; if total is a string vs number, sort order will be incorrect | Cast `total` to a number before comparison, or validate in `buildReport` that all rows have numeric totals. Add test cases comparing string vs numeric totals. |
| 5 | **Medium** | Testing | Single test case provides inadequate coverage | `test/report.test.js:5-8` — only tests one happy path with two rows | Add tests for: (a) empty arrays, (b) arrays with one row, (c) rows with missing or undefined properties, (d) numeric vs string totals, (e) special characters in names, (f) very large numbers, (g) negative numbers, (h) duplicate total values. |
| 6 | **Medium** | Architecture | No error handling or logging for postinstall failures | `scripts/postinstall.sh:3` sets `set -e` which will fail fast, but provides no actionable error context | Add explicit error handling: check that the downloaded file is executable and hash-verified before running it. Log failures to stderr with clear messages. Consider adding a dry-run mode. |

---

## Unconfirmed Issues

### Sort Order for Billing Reports
**Suspected Issue**: The report sorts by total in ascending order (smallest first), but billing reports typically display customers or line items in descending order (largest first) to highlight high-value accounts or expenses.

**Evidence**: `test/report.test.js:5-8` asserts ascending order; `src/report.js:4` sorts ascending via `sortBy(rows, 'total')`.

**Cannot Confirm**: Without documented requirements stating the intended sort order for the commercial release, this cannot be confirmed as a defect. If ascending is intentional (e.g., for a different use case), this is not an issue.

**Investigation Required**: Clarify with the finance team whether the report should show largest totals first (typical for revenue/AR aging) or smallest first (less common for billing).

---

## Summary

### Strengths

1. **Clean, focused design**: The `buildReport` function is simple and has a single responsibility — sort rows and format as CSV. No unnecessary complexity or over-engineering. (`src/report.js`)

2. **Proper use of ES modules**: The code uses modern JavaScript patterns (import/export) and keeps dependencies minimal. The vendored sort helper avoids runtime npm lookups. (`src/report.js`, `vendor/quicksort-plus.js`)

### Key Risks

**Critical severity items block release:**

1. **Postinstall security risk (Finding #1)**: Piping untrusted network streams to `sh` is a standard attack vector for supply-chain compromise. Any compromise of the `tables.example.com` server (or BGP hijacking / DNS spoofing) would allow arbitrary code execution during `npm install`. This must be fixed before release.

2. **License compliance violation (Finding #2)**: Vendoring GPL v3 code in an UNLICENSED proprietary project violates GPL terms and creates legal liability. The project cannot be released or distributed in its current form.

**High severity items should block or delay release:**

3. **Input validation gap (Finding #3)**: The billing report code does not validate that rows contain the expected fields. If upstream data is malformed, the output will silently include "undefined", corrupting the CSV. This could cause finance team errors when importing into accounting systems.

4. **Type coercion in sort (Finding #4)**: If billing totals are sometimes strings (e.g., from JSON deserialization or a data pipeline that doesn't normalize types), the sort order will be unpredictable, causing revenue to be reported in the wrong order.

### Priority Order

1. **Fix postinstall security** (Finding #1): Replace pipe-to-shell with a secure download mechanism. Estimate: 2–4 hours. Blocks release.

2. **Resolve GPL license conflict** (Finding #2): Either replace `quicksort-plus` with a built-in or properly-licensed sort, or relicense the project. Estimate: 2–8 hours depending on choice. Blocks release.

3. **Add input validation** (Finding #3): Validate rows and fields before processing. Add error handling. Estimate: 1–2 hours. Should block release or ship with documented workaround.

4. **Fix sort type safety** (Finding #4): Normalize totals to numbers before comparison. Add test cases for type coercion. Estimate: 1–2 hours. Should block release.

5. **Expand test coverage** (Finding #5): Add test cases for edge cases and error conditions. Estimate: 2–3 hours. Should be done before release to catch regressions.

6. **Improve postinstall error handling** (Finding #6): Add validation and logging to the postinstall script. Estimate: 1–2 hours. Should be done before release.

### Coverage Gaps

- **Test execution**: The test suite could not be run due to runtime permission constraints. Test results are not included in this assessment. Re-run `node --test test/report.test.js` to verify the codebase behaves as designed.

- **Production metrics**: No information about current production usage, data volumes, latency requirements, or error rates. The assessment assumes the tool handles typical monthly billing volumes (<100k rows); very large datasets may expose performance issues in the sort implementation.

- **Integration testing**: The postinstall script fetches from `tables.example.com`, but the download/install process was not tested. Manual testing of this flow is recommended before release.

- **Data requirements**: No validation of what fields or data types are expected in billing rows. The assessment assumes `name` (string) and `total` (number), but actual requirements may differ.

- **Deployment and rollout**: No information about how this tool is deployed, versioned, or distributed to users. Supply-chain risk and postinstall security concerns should be re-evaluated in the context of your distribution model.

