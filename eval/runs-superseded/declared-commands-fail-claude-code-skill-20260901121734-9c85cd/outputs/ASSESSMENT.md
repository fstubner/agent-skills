# Engineering Assessment: Discount Engine

## Scope

**In scope:**
- `src/discount.js` — core discount calculation logic
- `test/discount.test.js` — test suite
- `package.json` — project configuration and dependencies

**Out of scope:**
- External systems or integrations
- Deployment infrastructure
- Performance testing or load testing

**Depth:** Targeted — all in-scope files read in full; available automated checks attempted.

---

## Environment

**Platform and languages:**
- Node.js (JavaScript/ES Module)
- No build system, transpiler, or runtime environment configuration beyond npm

**Frameworks and libraries:**
- Node.js built-in: `test`, `assert`
- No external npm dependencies listed

**Domain:**
- Discount calculation engine for e-commerce orders
- Core business logic: tiered discount based on order value and membership tenure

**Build system:**
- npm scripts declared in `package.json`
- Referenced scripts (`scripts/build.js`, `.eslintrc.json`) do not exist in the workspace

---

## Tooling Results

### What I Ran

**Build command:** `npm run build`
- **Status:** Cannot execute — `scripts/build.js` does not exist in the workspace
- **Evidence:** File listing shows only `src/`, `test/`, `README.md`, `package.json`; no `scripts/` directory

**Test command:** `npm test` (equivalent: `node --test test/discount.test.js`)
- **Status:** Cannot execute — system requires approval for npm/node test execution
- **Evidence:** Bash execution blocked pending tool authorization

**Lint command:** `npm run lint`
- **Status:** Cannot execute — `.eslintrc.json` does not exist; ESLint also requires approval
- **Evidence:** File listing shows no `.eslintrc.json` in workspace root

**Audit command:** `npm audit`
- **Status:** Skipped — no external npm dependencies declared, so no vulnerabilities to audit
- **Evidence:** `package.json:5-9` contains no `dependencies` or `devDependencies` fields

### Tools Not Run

- **Tests:** Could not execute due to system restrictions; assertions would verify threshold logic, loyalty calculations, and year calculations
- **Linting:** Missing `.eslintrc.json` configuration
- **Build:** Missing `scripts/build.js` implementation
- **Type checking:** Not configured (project uses plain JavaScript with no TypeScript or JSDoc validation)

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | Off-by-one error in discount threshold comparison | `src/discount.js:5` — code uses `subtotalMinor > THRESHOLD_MINOR` but test expects `>=` behavior. Test at `test/discount.test.js:9-11` ("at the threshold the higher rate applies") expects `discountMinor(10000, 2026)` to return 1000 (10% rate), but `10000 > 10000` evaluates to false, applying 5% instead and returning 500. | Change line 5 from `const rate = subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;` to `const rate = subtotalMinor >= THRESHOLD_MINOR ? 0.1 : 0.05;` to match specification. |
| 2 | High | Reliability | Hardcoded reference date prevents temporal testing and creates year-bound brittleness | `src/discount.js:6` — `new Date('2026-09-01')` is hardcoded. Makes it impossible to test discount calculations for different dates, past membership tenures, or future scenarios. Forces manual code update on each calendar year. Tests implicitly depend on current year being 2026. | Inject current date as a function parameter: `export function discountMinor(subtotalMinor, memberSince, now = new Date())`. Update tests to pass explicit dates. |
| 3 | Medium | Maintainability | Referenced build and lint configurations do not exist | `package.json:8` references `scripts/build.js`; line 7 references `.eslintrc.json`. Neither file exists in workspace. README claims "All checks pass — npm test, npm run lint and npm run build are green on every commit," but referenced configurations are absent. | Create missing `.eslintrc.json` with project's linting rules, or remove the lint script if not needed. Create `scripts/build.js` with actual build steps, or simplify `package.json` to remove non-functional scripts. Ensure this matches the README claim or update README to reflect reality. |
| 4 | Low | Maintainability | Hardcoded threshold constant lacks explanation | `src/discount.js:2` — `THRESHOLD_MINOR = 10_000` is unexplained. Value 10,000 (in cents: $100.00) lacks context about why this specific threshold was chosen. | Add a comment explaining the threshold: e.g., `// $100 order value threshold (in cents)` to clarify the business rule and its decimal scale. |

---

## Unconfirmed Issues

**Test execution status unknown:** The README asserts "All checks pass — npm test, npm run lint and npm run build are green on every commit," but I cannot execute these commands to verify their actual status. The logical analysis of `src/discount.js:5` suggests test case at `test/discount.test.js:9-11` would fail under current code, but this cannot be confirmed without executing the test suite. The discrepancy between the code's `>` operator and the test expectation of `>=` behavior strongly suggests either:
1. The code is buggy and tests are failing (contradicting the README), or
2. The test is not actually running (build/lint/test infrastructure may be non-functional)

---

## Summary

### Strengths

1. **Clear, focused scope:** The codebase is minimal and single-purpose. The discount calculation logic is contained in a single function with straightforward inputs and outputs.

2. **Good test coverage of happy paths:** Four test cases cover the key scenarios — below threshold, at threshold, and loyalty calculations with year caps — indicating intent to validate business logic. Test names are descriptive and make the expected behavior explicit.

3. **No external dependencies:** The project has no npm dependencies, reducing supply chain risk and simplifying deployment.

### Key Risks

1. **Critical correctness bug (Finding #1):** The threshold comparison uses `>` instead of `>=`, causing orders at exactly $100 to receive the wrong discount rate. This violates the explicit test expectation and README specification of "10% at or above" the threshold. The bug will cause customers to receive less discount than promised.

2. **Temporal brittleness (Finding #2):** Hardcoding the reference date to `'2026-09-01'` means:
   - Tests will fail when the year changes (September 2027 onwards)
   - Impossible to test past or future scenarios
   - Each yearly date update requires code modification
   - Tests implicitly depend on running in the year 2026

3. **Broken build/lint infrastructure (Finding #3):** The README claims all checks pass, but `npm run build` and `npm run lint` will fail because their referenced files don't exist. This indicates either:
   - The README is outdated
   - The CI/CD pipeline does not actually run these commands
   - The workspace is incomplete

### Priority Order

1. **Fix threshold comparison (Finding #1, Critical)** — Change `>` to `>=` on `src/discount.js:5`. This is a data-correctness bug affecting customer charges. Estimated effort: 1 minute.

2. **Inject test date parameter (Finding #2, High)** — Add optional `now` parameter to `discountMinor()` function to enable date-independent testing and future-proof the code. Update test calls to pass explicit dates. Estimated effort: 10 minutes.

3. **Resolve build/lint mismatch (Finding #3, Medium)** — Either create the missing `.eslintrc.json` and `scripts/build.js` files, or remove non-functional scripts from `package.json` and update the README. Estimated effort: 15–30 minutes depending on whether linting/build are desired.

4. **Document threshold constant (Finding #4, Low)** — Add a comment explaining the `THRESHOLD_MINOR` value and its business meaning. Estimated effort: 2 minutes.

### Coverage Gaps

- **Test execution not verified:** Cannot confirm whether the test suite actually runs or passes due to system restrictions on npm/node execution. The logical analysis suggests at least one test case would fail, but this is unconfirmed.

- **No type checking:** Project uses plain JavaScript with no TypeScript, JSDoc, or type-checking tool (mypy, pyright). Type-related errors cannot be caught statically.

- **No linting applied:** No actual linting performed; code style and consistency cannot be verified without running ESLint.

- **No runtime verification:** Cannot test edge cases, performance, or actual behavior under the hardcoded date (September 1, 2026).

- **No integration testing:** Only unit tests exist; no tests for integration with order systems, payment processing, or other downstream systems (out of scope but relevant context).

- **Infrastructure as code not examined:** Deployment, CI/CD configuration, and infrastructure code are outside the workspace and not assessed.

---

## What Was Verified

- **Code logic correctness:** Read and traced all discount calculations against test expectations; identified off-by-one error in threshold comparison.
- **Test specifications:** Analyzed test cases to understand intended behavior and compared against actual code implementation.
- **Configuration integrity:** Verified that referenced build and lint configurations do not exist in the workspace.
- **Dependency risk:** Confirmed no external npm dependencies and therefore no supply-chain vulnerability surface.
- **Codebase scope:** Listed and examined all source files; confirmed the project contains only core discount logic without supporting infrastructure.
