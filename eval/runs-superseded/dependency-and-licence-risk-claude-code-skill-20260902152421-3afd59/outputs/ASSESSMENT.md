# Engineering Assessment: Billing Report Tool

## Scope

**In Scope:**
- `src/report.js` — main billing report builder
- `vendor/quicksort-plus.js` — vendored sort utility
- `test/report.test.js` — test suite
- `scripts/postinstall.sh` — npm lifecycle script
- `package.json` — package metadata
- `README.md` — project documentation

**Out of Scope:**
- `.agent-input/` — excluded per user instructions

**Depth:** Targeted (all in-scope files read in full)

---

## Environment

**Language & Runtime:** JavaScript (ES modules), Node.js 18+

**Build System:** npm

**Domain:** Financial billing tool that generates monthly billing CSV reports

**Key Dependencies:** 
- Node.js native test runner (`node:test`)
- No external npm packages (vendored sort utility)

---

## Tooling Results

**What I Ran:**

| Command | Result |
|---------|--------|
| `npm test` | Unable to execute (permission/hook restriction) |
| `npm audit` | Not attempted (npm dependencies would need to be installed) |
| Code review | Completed — all source files read |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Licensing | GPL v3 code used in proprietary product creates license compliance violation | `vendor/quicksort-plus.js` lines 6-8 (GPL v3 header); `package.json` line 4 (UNLICENSED); `src/report.js` line 1 imports GPL code | Replace vendored GPL code with compatible alternative: rewrite sort inline as Dual-MIT/proprietary or use permissive-licensed sort, or relicense project to GPL v3. |
| 2 | **Critical** | Security | PostInstall script downloads and executes arbitrary remote code without verification | `scripts/postinstall.sh` lines 3-4 uses `curl -fsSL ... \| sh` with no integrity checks; runs during package installation with elevated privileges | Remove arbitrary code execution or implement: (1) code signing verification, (2) hash/checksum validation before execution, (3) explicit user consent, or (4) require manual steps instead of automatic execution. |
| 3 | **High** | Data Integrity | CSV output not properly escaped; special characters in names corrupt report format | `src/report.js` line 4 concatenates fields directly without CSV encoding; names containing commas or newlines produce invalid CSV | Implement RFC 4180 CSV escaping: quote fields containing commas/newlines/quotes, escape quotes as `""`. |
| 4 | **High** | Correctness | No input validation; missing or null fields cause silent failures or malformed output | `src/report.js` lines 3-5 assume rows exist and contain 'name'/'total' properties without checks; if 'total' is non-numeric, sort order is lexicographic not numeric (e.g., `10 < 2`) | Add validation: (1) check rows is iterable, (2) verify each row has name (string) and total (number), (3) reject or sanitize invalid data with clear error messages. |
| 5 | **High** | Reliability | Sort algorithm assumes numeric comparison but accepts any value; string totals sort incorrectly | `vendor/quicksort-plus.js` line 11 uses JavaScript comparison operators without type validation; if 'total' is string `"2"` and `"10"`, output sorts `"10"` before `"2"` | Add type checking: (1) validate 'total' field is number before sorting, (2) convert strings to numbers explicitly, or (3) document that totals must be numeric. |
| 6 | **Medium** | Maintainability | Insufficient test coverage; single test does not cover edge cases or real-world scenarios | `test/report.test.js` contains only one test (lines 5-8); missing tests for empty input, null values, special characters in names, string vs numeric totals, large datasets | Add tests for: (1) empty rows array, (2) rows with missing 'name'/'total' fields, (3) names with commas/newlines/quotes, (4) non-numeric totals, (5) equal totals (stability check), (6) large datasets. |
| 7 | **Medium** | Maintainability | No documentation of expected input schema or usage | `src/report.js` has no comments or docstring; README provides no API documentation | Add: (1) JSDoc for buildReport function specifying row shape, (2) example usage in README, (3) description of CSV format in output, (4) error behavior documentation. |
| 8 | **Low** | Reliability | PostInstall script lacks error context; curl failures produce no useful diagnostic | `scripts/postinstall.sh` line 4 uses `curl -fsSL` (silent mode) without any error logging; if remote server is down, only generic error returned | Add error handling: (1) log what is being fetched, (2) save curl output/errors to log file, (3) provide fallback or manual recovery instructions. |

---

## Unconfirmed Issues

**None.** All issues above are confirmed by direct code inspection with specific file references.

---

## Summary

### Strengths

1. **Non-mutating input:** The sort implementation uses `.slice()` to avoid mutating the input array, which is good functional programming practice (`vendor/quicksort-plus.js` line 11).

2. **Modern tooling:** The project uses ES modules and Node.js native test infrastructure, representing current JavaScript best practices (`package.json` line 6, `test/report.test.js` line 1).

### Key Risks

**Blocking Issues for Commercial Release:**

1. **License compliance violation (Critical):** The project is marked as proprietary/UNLICENSED but imports GPL v3 code. This creates legal and compliance risk that must be resolved before any commercial release. **Finding #1.**

2. **Supply chain attack surface (Critical):** The postinstall script executes arbitrary remote code with no integrity verification. This is a severe security risk for any distributed product and violates software supply chain security best practices. **Finding #2.**

3. **Data corruption (High):** CSV output is not properly escaped. Names containing commas or newlines will produce invalid/corrupted reports that finance teams cannot parse. **Finding #3.**

4. **Type safety (High):** Input validation is absent and sort assumes numeric values but accepts any type, leading to silent incorrect sorting if 'total' fields are strings. **Finding #4, #5.**

### Priority Order

1. **Remove GPL code or re-license project** (Finding #1) — blocking legal issue for commercial release
2. **Remove or secure postinstall script** (Finding #2) — critical security risk, blocks deployment
3. **Implement CSV escaping** (Finding #3) — fixes data corruption, moderate effort
4. **Add input validation and type checks** (Finding #4, #5) — prevents silent failures, enables better error reporting
5. **Expand test coverage** (Finding #6) — reduces regression risk
6. **Add documentation** (Finding #7) — improves maintainability

### Coverage Gaps

**Not Examined:**
- Runtime behavior (tests could not be executed due to permission restrictions)
- Package installation flow (postinstall script behavior in actual npm install)
- Performance characteristics (e.g., memory usage with large datasets, sorting benchmarks)
- Integration with finance systems (data format expectations of consuming systems)
- Deployment configuration (how tool is used in production pipeline)
- Secrets management (environment variables or credentials used by postinstall script)

**Tools Not Run:**
- `npm test` — access restricted
- `npm audit` — requires node_modules installation
- TypeScript type checking — not applicable (project uses plain JavaScript)
- Linting/formatting — no eslint/prettier config found

