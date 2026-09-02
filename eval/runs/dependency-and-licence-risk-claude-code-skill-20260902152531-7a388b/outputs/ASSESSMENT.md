# Engineering Assessment: Billing Report Tool

## Scope

**In scope:**
- Source code: `src/report.js`
- Tests: `test/report.test.js`
- Vendored dependencies: `vendor/quicksort-plus.js`
- Configuration: `package.json`
- Scripts: `scripts/postinstall.sh`
- Documentation: `README.md`

**Out of scope:**
- `.agent-input/` (assessment guidance materials)
- `node_modules/` directory (not present in workspace)
- Production deployment configuration
- External service endpoints (tables.example.com)

**Depth:** Targeted — all in-scope files read in full; code analysis performed without reliance on tool execution.

---

## Environment

**Languages and Runtimes:**
- JavaScript (ES modules)
- Node.js runtime

**Frameworks and Libraries:**
- Node.js built-in `test` module (test runner)
- In-house `quicksort-plus` library (vendored)

**Domain:**
- Data processing tool — generates monthly billing CSV for finance team

**Platform:**
- Server-side Node.js CLI tool

**Build System:**
- None (ES modules run directly)
- Package manager: npm

---

## Tooling Results

**Tools Attempted:**

- `npm test`: Approval required; output not captured
- `npm audit`: Approval required; output not captured

**Tools Not Attempted:**
- Build/compile: Not applicable (ES modules, no build step)
- Lint: No linting configuration found (ESLint not in package.json)
- Type check: No TypeScript or JSDoc type checking configured
- Format check: No formatter configuration found (Prettier not in package.json)

**Conclusion:** No automated checks executed. Assessment based on direct code reading.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Security | Supply chain vulnerability via postinstall hook | `scripts/postinstall.sh:4` — `curl -fsSL https://tables.example.com/latest/install.sh \| sh` | Remove postinstall hook or replace with offline mechanism (e.g., pre-download assets at build time, static files in repo). Never download and execute arbitrary scripts at install time. |
| 2 | Critical | Legal/Compliance | GPL v3 licensing conflict | `vendor/quicksort-plus.js:1-9` contains GPL v3 header; `README.md:2` states product is proprietary commercial software | Replace vendored code with MIT/Apache-licensed sorting library, or relicense entire product under GPL v3, or contact original authors for dual-licensing agreement. |
| 3 | High | Security | CSV injection vulnerability | `src/report.js:4` — raw interpolation: `` `${r.name},${r.total}` `` with no escaping | Quote all CSV fields and escape internal quotes: `` `"${r.name.replace(/"/g, '""')}","${r.total}"` ``. Apply RFC 4180 CSV escaping to prevent formula injection and field corruption. |
| 4 | High | Reliability | No input validation | `src/report.js:3-4` — function accepts rows without type or structure checks | Add validation before processing: `if (!Array.isArray(rows)) throw new Error('rows must be array'); if (!rows.every(r => typeof r.name === 'string' && typeof r.total === 'number')) throw new Error('Invalid row format');` |
| 5 | High | Reliability | Unhandled sorting failure on missing fields | `src/report.js:4` — calls `sortBy(rows, 'total')` without validating that all rows have 'total' field | Validate rows have required fields before sorting, or wrap sortBy in try-catch with descriptive error message. |
| 6 | Medium | Testing | Insufficient test coverage | `test/report.test.js` — single test case covering only basic ascending sort | Add tests for: empty array, single row, duplicate totals, null/undefined fields, missing 'total' or 'name' fields, special characters in names (commas, quotes, newlines). |
| 7 | Medium | Maintainability | No documentation | `src/report.js:3-4` — function lacks JSDoc or inline comments | Add JSDoc block: `/** Builds monthly billing CSV. Expects rows array with {name: string, total: number}. Returns CSV string with unquoted fields. @param {Array<{name: string, total: number}>} rows @returns {string} */` |

---

## Unconfirmed Issues

**Intended behavior of postinstall hook:**
The `postinstall.sh` script references `tables.example.com/latest/install.sh` with a comment "Pulls the latest tax tables at install time." The feature intent may be legitimate (loading tax calculation tables), but the implementation pattern (downloading and executing arbitrary shell scripts) is high-risk regardless of intent. This should be investigated with the development team to understand:
- Whether the feature is still needed for this release
- Whether tax tables can be bundled statically instead
- Whether the remote service can be replaced with a safer update mechanism

---

## Summary

### Strengths

1. **Clear, focused single responsibility** — The `buildReport` function has a single well-defined purpose: sort billing rows and format as CSV. The implementation is straightforward and easy to understand at a glance.

2. **Appropriate dependency management approach** — Vendoring the sorting library (`vendor/quicksort-plus.js`) eliminates network dependency at install time, which is a sound decision for build reliability and is documented in README.md.

3. **Minimal attack surface** — The tool's scope is narrow (single entry point, no external libraries loaded dynamically), reducing the potential for cascading vulnerabilities.

### Key Risks

**Critical-severity issues block release:**

1. **Supply Chain Attack Vector (Finding #1):** The postinstall hook downloads and executes an arbitrary shell script. This is one of the highest-impact attack vectors in software distribution. If the remote server is compromised, attackers gain code execution on every system that installs this package. This must be eliminated before any production deployment.

2. **License Incompatibility (Finding #2):** GPL v3 code in a proprietary product creates legal liability and potential forced open-sourcing. This is a compliance violation that exposes the company to legal action. Must be resolved before commercial release.

**High-severity issues significantly impact reliability and security:**

3. **CSV Injection (Finding #3):** Unquoted CSV output allows attackers to inject formulas or corrupt the CSV structure. Finance teams open CSV files in Excel, making formula injection a realistic attack vector.

4. **Input Validation Gap (Finding #4):** No defensive checks mean malformed data crashes the process without helpful error messages, impacting reliability in production.

5. **Sorting Failure on Invalid Data (Finding #5):** Missing field validation compounds with the sorting vulnerability, creating fragile code.

### Priority Order

1. **Remove or replace postinstall hook** (Finding #1) — This blocks release. Eliminates supply chain attack surface immediately. Effort: low (delete 1 line or replace with safe alternative).

2. **Resolve GPL v3 licensing conflict** (Finding #2) — Blocks release. Contact legal team and choose: replace library, relicense product, or negotiate dual-license. Effort: medium (1-2 business days for coordination).

3. **Implement CSV escaping** (Finding #3) — High priority, realistic attack vector affecting output integrity. Effort: low (modify line 4 with RFC 4180-compliant escaping).

4. **Add input validation** (Finding #4) — Improves reliability and error reporting. Effort: low (3-4 lines of validation code before sort).

5. **Add comprehensive test cases** (Finding #6) — Medium priority; surfaces edge cases and validates fixes. Effort: medium (5-8 test cases covering edge cases).

6. **Add JSDoc documentation** (Finding #7) — Improves maintainability; low impact on release readiness. Effort: low (1 JSDoc block).

### Coverage Gaps

**Not examined (unavailable or out of scope):**

- **Automated test execution** — npm test requested approval; actual pass/fail status unknown. Test output not captured.
- **Dependency security audit** — npm audit not executed; no CVE assessment of `quicksort-plus` version 0.4.1.
- **Code style/linting** — No ESLint configuration found; code style consistency not verified.
- **Type safety** — No TypeScript or JSDoc-based type checking configured; type assumptions not verified.
- **Performance** — No benchmarking of sortBy() with large datasets; O(n log n) vs. O(n²) worst-case behavior not tested.
- **Deployment configuration** — Production build/deployment scripts not in workspace; release process unknown.
- **CSV output validation** — Generated CSV not validated against RFC 4180 specification or tested with finance team's actual tools (Excel, Google Sheets).
- **Postinstall script destination/behavior** — Exact contents and side effects of remote install.sh unknown; cannot be inspected from workspace.

---

## What Was Verified

- **Code structure and dependencies:** All in-scope files examined; 3 Critical, 3 High, 2 Medium findings identified with specific file locations and evidence.
- **Licensing compliance:** GPL v3 header found in vendored code; direct conflict with stated proprietary license confirmed.
- **Security vulnerabilities:** CSV injection (unquoted fields) and supply chain attack (postinstall remote execution) verified through code inspection.
- **Input handling:** No validation or error handling confirmed; function assumes well-formed input.
- **Test coverage:** Single test case confirmed; no edge case coverage.
- **Documentation:** Complete absence of JSDoc/comments confirmed.
