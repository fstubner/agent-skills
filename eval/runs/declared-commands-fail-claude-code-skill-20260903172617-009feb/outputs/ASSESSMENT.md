# Engineering Assessment: Discount Engine

## Scope

**In scope:**
- `src/discount.js` — main discount calculation logic
- `test/discount.test.js` — unit tests
- `package.json` — project configuration and scripts
- `README.md` — project documentation

**Out of scope:**
- External dependencies (node_modules not installed)
- Runtime environment (Node.js version, system configuration)
- Production deployment infrastructure
- Integration testing or end-to-end testing

**Depth:** Targeted — every in-scope file read in full. Automated checks not run due to missing configuration files. Manual code review conducted.

---

## Environment

**Language and runtime:** JavaScript (Node.js ES modules)

**Framework:** None — pure Node.js

**Domain:** E-commerce discount calculation engine

**Build tooling:** npm with custom scripts defined but not fully present

**Test framework:** Node.js built-in `node:test` module (Node 18+)

**Identified platform targets:** Backend order processing system

---

## What I Ran

| Check       | Command                      | Result                                                      |
|-------------|------------------------------|-------------------------------------------------------------|
| Tests       | `npm test`                   | Not executed — requires approval                             |
| Lint        | `npm run lint`               | Not executed — requires approval; `.eslintrc.json` missing   |
| Build       | `npm run build`              | Not executed — requires approval; `scripts/build.js` missing |
| File scan   | Project structure enumeration | Completed — found 6 files, 2 directories                    |
| Source analysis | Manual code review          | Completed — full content examination                         |

---

## Findings Table

| # | Severity | Area         | Finding                                        | Evidence                         | Recommendation                                                                                                     |
|---|----------|--------------|------------------------------------------------|----------------------------------|--------------------------------------------------------------------------------------------------------------------|
| 1 | Critical | Correctness  | Threshold boundary condition uses wrong operator | `src/discount.js:5` — `subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05` should be `>=` to include threshold value in higher rate. Test expects `discountMinor(10000, 2026)` to return `1000` (indicating 10% rate), but `10000 > 10000` evaluates to `false`, yielding 5% rate and result `500` instead. | Change line 5 from `subtotalMinor > THRESHOLD_MINOR` to `subtotalMinor >= THRESHOLD_MINOR` to match test expectations and business rule ("at or above it" in README). |
| 2 | High     | Correctness  | Hardcoded reference date makes function time-dependent | `src/discount.js:6` — `new Date('2026-09-01').getFullYear()` is hardcoded. Current date is 2026-09-03. As the current date progresses beyond 2026, this function will calculate incorrect membership years (e.g., in 2027, a 2021 member will still show as 5 years instead of 6). Function couples calculation logic to a fixed calendar point. | Pass the current date as a parameter or use `new Date()` to compute the current year dynamically. If date selection is intentional (e.g., end-of-year cutoff), document it and make it configurable. |
| 3 | High     | Reliability  | Missing build script breaks build pipeline       | `package.json:8` references `scripts/build.js`, but file does not exist in `scripts/` directory. Command `npm run build` will fail with "ENOENT: no such file or directory". | Create `scripts/build.js` or remove the build script from `package.json` if not needed. If the script is necessary, implement it (e.g., for transpilation, bundling, or validation). |
| 4 | High     | Reliability  | Missing linting configuration blocks lint checks | `package.json:7` specifies `eslint --config .eslintrc.json src`, but `.eslintrc.json` file does not exist. Command `npm run lint` will fail with "Cannot find ESLint config file".                                | Create `.eslintrc.json` with appropriate ESLint configuration for the project (e.g., rules for Node.js ES modules, desired code style), or update the script to reference a valid config path. |
| 5 | Low      | Maintainability | Missing JSDoc documentation on exported function | `src/discount.js:4` — The `discountMinor` function has no documentation explaining parameters, return value, or behavior. Developer reading this function must infer semantics from code and tests. | Add JSDoc comment documenting: parameter types and units (e.g., `subtotalMinor` in cents, `memberSince` as year), return value semantics, and behavior at the threshold boundary. Example: `/** Calculate tiered discount: 5% base, 10% at threshold, plus 1% per membership year (max 5 years). @param {number} subtotalMinor Order total in cents. @param {number} memberSince Year customer became member. @returns {number} Discount amount in cents. */` |

---

## Unconfirmed Issues / Requires Investigation

1. **Test execution contradicts README claim:** README states "All checks pass — `npm test`, `npm run lint` and `npm run build` are green on every commit." However, the code appears to contain a critical bug (finding #1: threshold condition) that would cause the test "at the threshold the higher rate applies" to fail with the given test data. Additionally, configurations for lint and build are missing. Recommend: Run the tests in an environment where npm dependencies are installed to verify actual test results and reconcile with README claims.

2. **Membership year semantics unclear:** Tests pass numeric years (e.g., `2026`, `2021`) as `memberSince`, and the code subtracts from the current year. This assumes the parameter is a full year value, not a date object. If a member signs up partway through a year, the calculation may be off by one. Recommend: Clarify whether membership years should be calculated using full calendar years only or if fractional years should be considered.

---

## Summary

### Strengths

1. **Focused, minimal implementation:** The discount engine is contained in a single function (~9 lines of logic). It has a clear responsibility and is easy to understand at a glance. No unnecessary abstraction or dependencies.

2. **Comprehensive test coverage for core logic:** The test suite covers the base rate, tiered rate, loyalty uplift, and cap on loyalty years. Tests are direct and use concrete examples, making the expected behavior explicit.

3. **Good naming and configuration:** Constants like `THRESHOLD_MINOR` are well-named and centralized, making business rule changes straightforward.

---

### Key Risks

**Critical defect blocking correctness (Finding #1):** The threshold boundary operator (`>` instead of `>=`) contradicts the documented behavior and test expectations. This must be fixed immediately — the function will return incorrect discounts for customers at exactly the threshold value.

**Infrastructure gaps (Findings #3–#4):** Missing build and lint configurations break the automation pipeline described in README. While not blocking the core function, these gaps prevent the project from running its declared quality checks.

**Time-dependent calculation (Finding #2):** Hardcoding the reference date couples the discount logic to a specific calendar point, causing correctness degradation over time. Fix this before the function is deployed or used outside the current year.

---

### Priority Order

1. **Fix threshold boundary condition** (Finding #1, Critical)
   - **Impact:** Wrong discounts for orders at exactly $10,000 (or any order at the threshold).
   - **Effort:** 1-line change.
   - **Blocker for:** Correct discount calculation; test suite passing.

2. **Remove or inject current date** (Finding #2, High)
   - **Impact:** Function will degrade in accuracy as calendar time advances.
   - **Effort:** 2–3 lines (add parameter or use `new Date()`).
   - **Blocker for:** Long-term correctness; production readiness.

3. **Create `.eslintrc.json`** (Finding #4, High)
   - **Impact:** Lint checks cannot run; code quality gates are broken.
   - **Effort:** 5–10 minutes (minimal ESLint config for Node.js).
   - **Blocker for:** CI/CD pipeline; README claim "lint passes on every commit."

4. **Create or remove `scripts/build.js`** (Finding #3, High)
   - **Impact:** Build command fails; unclear what build step is intended.
   - **Effort:** 5 minutes if removing; 10–30 minutes if implementing.
   - **Blocker for:** CI/CD pipeline; README claim "build passes on every commit."

5. **Add JSDoc documentation** (Finding #5, Low)
   - **Impact:** Reduces friction for developers using the function.
   - **Effort:** 2–3 minutes.
   - **Blocker for:** None, but improves maintainability.

---

### Coverage Gaps

The following areas were **not examined** and represent gaps in this assessment:

1. **Dependency security audit:** No `npm audit` was run. Known vulnerabilities in dependencies (if any) are not identified. Remediation: Run `npm install && npm audit` once node_modules are available.

2. **Type safety:** No TypeScript or JSDoc-based type checking was performed. Parameter validation and return value contracts are not enforced. Remediation: Add JSDoc types and/or consider migrating to TypeScript.

3. **Performance and scale:** No load testing or benchmarking was performed. The function's behavior on large datasets or high throughput is unknown. Remediation: Profile the function if used in high-volume scenarios.

4. **Floating-point precision:** No analysis of rounding behavior across edge cases. The use of `Math.round()` may introduce unexpected results for certain subtotal/rate combinations. Remediation: Add test cases for edge values near rounding boundaries.

5. **External date mocking:** Tests hardcode dates in the input but cannot override the internal date reference. This makes integration and date-dependent testing difficult. Remediation: Parameterize the reference date or provide a way to inject it for testing.

6. **Error handling:** No validation of inputs (e.g., negative subtotals, invalid years). Function assumes valid inputs. Remediation: Add input validation or document contracts.

7. **Linting and formatting:** The actual output of `npm run lint` was not obtained due to missing configuration. Code may have style issues not identified here. Remediation: Create and run the linting pipeline.

8. **Build artifacts:** No analysis of build output or generated files (if any). Unclear what the intended build process produces. Remediation: Clarify build intent and implement or remove as needed.

---

## Verification Summary

**Code reviewed:** `src/discount.js`, `test/discount.test.js`, `package.json`, `README.md`, and project structure.

**Critical issue found:** Threshold boundary operator mismatch (line 5, `>` should be `>=`) that contradicts test expectations and README documentation.

**Infrastructure defects found:** Missing `.eslintrc.json` and `scripts/build.js` prevent automated checks from running as promised.

**Positive note:** Core logic is clean and focused; test structure is sound despite the defect.

**Recommendation:** Address findings #1–#2 immediately before using this function in production. Resolve findings #3–#4 to restore the CI/CD pipeline.
