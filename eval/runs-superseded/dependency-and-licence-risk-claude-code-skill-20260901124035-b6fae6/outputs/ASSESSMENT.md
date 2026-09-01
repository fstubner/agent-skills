# Engineering Assessment: Billing Report Tool

## Scope

**In Scope:**
- Source code: `src/report.js` (main module)
- Vendored dependencies: `vendor/quicksort-plus.js`
- Test suite: `test/report.test.js`
- Build configuration: `package.json`, `scripts/postinstall.sh`
- Documentation: `README.md`

**Out of Scope:**
- Integration with downstream finance systems
- Production deployment configuration
- User authentication or access control
- Data source pipelines feeding this tool
- Performance testing under production load
- Actual tax table files or network behavior

**Depth:** Targeted (all in-scope files read in full; tooling attempted but execution blocked by approval requirements)

---

## Environment

**Language & Runtime:** JavaScript (Node.js v24.14.1)

**Build System & Package Manager:** npm (version not retrieved due to approval restrictions)

**Domain:** Command-line billing CSV generation tool for financial reporting

**Key Dependency:** Vendored quicksort-plus.js (v0.4.1, GPLv3 license)

**Main Entry Point:** `src/report.js` exporting `buildReport(rows)`

---

## Tooling Results

### Tools Run Successfully
None — all automated checks required approval that was not granted.

### Tools Attempted & Blocked
- **`npm test`** — Required approval; not executed. Would verify test suite.
- **`node --test test/report.test.js`** — Required approval; not executed. Would execute unit tests.
- **`npm audit`** — Required approval; not executed. Would identify known vulnerabilities in dependencies.
- **Build command** — No `npm run build` script defined in `package.json`.

### Node Version (Retrieved)
- Node.js v24.14.1 available

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Security | Supply chain attack vector: `curl \| sh` in postinstall script | `scripts/postinstall.sh:3-4` — script downloads and executes arbitrary code from `https://tables.example.com/latest/install.sh` without verification or checksum validation | Replace with either: (a) vendored tax tables checked into the repo, (b) a hash-verified binary download with signature checking, or (c) remove the postinstall hook entirely and document manual setup. Never pipe untrusted network content to shell. |
| 2 | **Critical** | Security | CSV formula injection vulnerability | `src/report.js:4` — the `name` field is concatenated directly into CSV output without escaping. If `name` starts with `=`, `+`, `@`, or `-`, it becomes an executable formula in Excel/Google Sheets | Apply proper CSV escaping: wrap fields in double quotes and escape internal quotes, or use a CSV library. For example, if `name` is `=cmd\|'/c calc'`, the output becomes an injection vector. |
| 3 | **Critical** | Correctness | No input validation; corrupts output on malformed input | `src/report.js:3-4` — function assumes `rows` is an array of objects with `name` (string) and `total` (number) fields. No validation: if `rows` is null, `total` is non-numeric, or properties are missing, the output is silently corrupted. Example: `buildReport([{name:'a',total:'NaN'}])` produces `a,NaN` instead of failing. | Add validation at the function entry: assert `Array.isArray(rows)`, check each row has required properties, validate `total` is a number. Throw descriptive errors on invalid input. |
| 4 | **High** | Legal/Licensing | GPL v3 license conflict with proprietary product | `vendor/quicksort-plus.js:1-8` — file header declares GPL v3 ("This program is free software..."). `README.md:3-4` states the tool is proprietary and not distributed under open source license. Shipping GPLv3 code with a proprietary product violates the GPL license terms. | Option A: Replace quicksort-plus with a permissively licensed sort (built-in `Array.sort()` is sufficient for this use case and license-free). Option B: Audit whether GPL applies to the entire product (unlikely for commercial use). Option C: Contact copyright holder for license grant. Most practical: use native sort and remove vendor dependency. |
| 5 | **High** | Reliability | Sorting fails silently on null/undefined values | `vendor/quicksort-plus.js:11` — comparison `a[key] > b[key]` produces unexpected behavior when either value is `null` or `undefined`. In JavaScript, these comparisons return `false`, leading to non-deterministic sort order. If a row has `total: undefined`, it may appear in any position. | Add type checking before sort: validate that `total` is a number. Reject rows with missing/invalid totals in `buildReport()` input validation (see Finding #3). |
| 6 | **Medium** | Testing | Test suite has minimal coverage | `test/report.test.js:5-8` — only one test case covering the happy path (two rows, numeric totals). Missing test cases for: empty array, single row, null/undefined values, non-numeric totals, special characters in names, large datasets, duplicate totals. | Add tests for edge cases and error conditions: empty input, invalid property types, CSV-unsafe characters in `name` (e.g., commas, quotes, newlines, formula characters). Run with `npm test` to verify. |
| 7 | **Medium** | Maintainability | No input/output documentation | `src/report.js` has no JSDoc or comments explaining: what `rows` should contain, what properties are required, what `buildReport()` returns, error conditions. Callers must infer from test or reverse-engineer from code. | Add JSDoc comment above `buildReport()` documenting: parameter type and shape, return type, allowed/required row properties, behavior on invalid input, and CSV format details. |
| 8 | **Medium** | Architecture | Unnecessary external dependency | The tool uses a vendored quicksort library, but JavaScript's native `Array.sort()` is sufficient and license-free. The vendored library adds compliance risk (GPL license), maintenance burden, and minimal value. | Replace `sortBy(rows, 'total')` with native `rows.sort((a, b) => a.total - b.total)` and remove `vendor/quicksort-plus.js`. This is a one-line change in `src/report.js` and eliminates a dependency. |

---

## Unconfirmed Issues

None at this time. All findings listed above have been confirmed via direct code inspection.

---

## Summary

### Strengths

1. **Minimal surface area** — The tool is small and focused, with only one exported function and a single dependency. This simplicity makes it easier to audit and reduces the blast radius of bugs.

2. **Appropriate use of native testing** — The test suite uses Node.js built-in `node:test` and `node:assert`, avoiding unnecessary external test framework dependencies.

### Key Risks

The tool has **three critical-severity findings** that block commercial release:

1. **Supply chain security (Finding #1)** — The postinstall script executes arbitrary remote code without verification. This is an active attack vector and must be eliminated before shipping.

2. **Data corruption (Findings #2, #3)** — Missing input validation and CSV injection vulnerabilities mean that malformed or malicious input can produce corrupted billing data without error. For a financial tool, data integrity is non-negotiable.

3. **Sorting reliability (Finding #5)** — Null/undefined values in the `total` field produce non-deterministic sort order, corrupting report order without warning.

The **High-severity license conflict (Finding #4)** exposes the company to legal risk and must be resolved before release.

### Priority Order

1. **Remove postinstall.sh hook entirely** (Finding #1) — Blocks release. No external code execution in automated install. If tax tables are needed, commit them to the repo or document manual download steps.

2. **Add comprehensive input validation** (Finding #3) — Implement type and shape validation for the `rows` parameter. Return clear error messages on invalid input. Prevents silent data corruption.

3. **Implement CSV escaping** (Finding #2) — Wrap all string fields in quotes and escape internal quotes per RFC 4180. Test with formula characters (`=`, `+`, `@`, `-` in first column).

4. **Resolve GPL license conflict** (Finding #4) — Replace `vendor/quicksort-plus.js` with native `Array.sort()`. Eliminates license risk and external dependency in one change. (See Finding #8 for implementation details.)

5. **Add null/undefined handling for sort key** (Finding #5) — Validate in input validation layer (step 2 above) that `total` is a number. Prevents non-deterministic behavior.

6. **Expand test coverage** (Finding #6) — Add tests for edge cases: empty input, invalid types, CSV-unsafe characters. Run `npm test` to verify all cases pass after fixes above.

7. **Add API documentation** (Finding #7) — Document input format, required properties, return value, and error conditions via JSDoc.

### Coverage Gaps

- **Automated test execution not performed** — Approval restrictions prevented running `npm test` and `node --test`. The existing test suite may pass or fail; status is unverified. Recommendation: run tests in release environment.

- **Dependency audit not performed** — `npm audit` was blocked. Cannot confirm absence of known vulnerabilities in transitive dependencies (though the only explicit dependency is the vendored quicksort, which has no network transitive dependencies).

- **Integration testing not in scope** — No validation of output format compatibility with downstream finance systems, data pipelines, or CSV importers.

- **Performance testing not performed** — No testing of sort performance on large datasets (e.g., 100k+ billing rows) or memory usage under load.

- **No audit of data source** — Cannot verify where `rows` input originates, whether it is already validated upstream, or whether validation should be defensive (assume untrusted) or assume upstream validation.

- **No review of actual CSV parsing behavior** — CSV output was not validated against an actual parser (Excel, Google Sheets, etc.) to confirm RFC 4180 compliance and injection resistance.

---

## What Was Verified

✓ Source code structure and dependencies  
✓ Input/output logic in `buildReport()`  
✓ Sorting implementation in `vendor/quicksort-plus.js`  
✓ Test coverage in `test/report.test.js`  
✓ Build configuration and scripts  
✓ License declarations and conflicts  
✓ Security vectors: postinstall, CSV injection, input validation  
✓ No automated tests were executed (approval blocked)  
✓ No CLI or integration behavior tested

**Recommendation:** Resolve the three critical findings and one high-severity licensing issue before commercial release. Run the full test suite after fixes to confirm no regressions.
