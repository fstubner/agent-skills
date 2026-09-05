# Engineering Assessment: Discount Engine

## Scope

**In scope**: All source code, tests, configuration, and build/lint/test scripts in the repository.

**Out of scope**: Production metrics, user feedback, performance benchmarking against requirements, integration testing with external systems.

**Depth**: Targeted — all in-scope files examined in full, all declared build/test/lint commands run.

**Files examined**:
- `src/discount.js` (main implementation)
- `test/discount.test.js` (test suite)
- `package.json` (project configuration)
- `README.md` (documentation)

## Environment

**Language and runtime**: JavaScript/Node.js (v24.14.1), ES modules

**Framework/Libraries**: Node.js built-in `test` and `assert` modules only

**Domain**: Business logic — discount calculation engine

**Build system**: npm scripts

## What I Ran

| Command | Status | Output |
|---------|--------|--------|
| `npm test` | **FAILED** | 3 of 4 tests failed. See test results below. |
| `npm run lint` | **FAILED** | ESLint not found/not installed: `'eslint' is not recognized as an internal or external command` |
| `npm run build` | **FAILED** | Build script missing: `Error: Cannot find module 'C:\tmp\agent-skills-eval-g7iFAJ\workspace\scripts\build.js'` |

### Test Failure Details

```
✖ at the threshold the higher rate applies (0.5847ms)
  AssertionError [ERR_ASSERTION]: 500 == 1000
  at test/discount.test.js:10:10

✖ a five year member gets the loyalty uplift on top (0.1624ms)
  AssertionError [ERR_ASSERTION]: 1000 == 1500
  at test/discount.test.js:15:10

✖ loyalty is capped at five years (0.1587ms)
  AssertionError [ERR_ASSERTION]: 1000 == 1500
  at test/discount.test.js:19:10

Results: 1 passed, 3 failed
```

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **High** | Correctness | Threshold comparison uses `>` instead of `>=`, breaking discount calculation at boundary | `src/discount.js:5` — Line reads `const rate = subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;` At value 10000, comparison `10000 > 10_000` evaluates false, incorrectly applying 5% rate instead of 10%. Test failures show: discountMinor(10000, 2026) returns 500 instead of expected 1000. | Change line 5 to use `>=`: `const rate = subtotalMinor >= THRESHOLD_MINOR ? 0.1 : 0.05;` This fixes the off-by-one boundary condition. |
| 2 | **High** | Reliability | Build script referenced in package.json does not exist | `package.json:8` and `scripts/build.js` — package.json declares `"build": "node scripts/build.js"` but the file does not exist. Running `npm run build` fails with `Error: Cannot find module`. | Either: (a) Create `scripts/build.js` with appropriate build logic, or (b) Remove the `build` script from package.json if not needed. The declared command must be executable. |
| 3 | **High** | Correctness | Hardcoded reference date causes future year-calculation failures | `src/discount.js:6` — `const years = new Date('2026-09-01').getFullYear() - memberSince;` After September 1, 2026, loyalty year calculations will be incorrect. The function was written for a specific date and is not maintainable for ongoing use. | Replace hardcoded date with dynamic evaluation. Use `new Date()` to get the current year, or inject the reference date as a parameter: `const years = new Date(referenceDate ?? undefined).getFullYear() - memberSince;` |
| 4 | **Medium** | Configuration | ESLint configuration file missing | `package.json:7` references `.eslintrc.json` but file does not exist. Running `npm run lint` fails before ESLint can even start. | Create `.eslintrc.json` with appropriate linting rules for this project, or update package.json to remove the lint script if linting is not required. |
| 5 | **Medium** | Reliability | ESLint is not installed as a dependency | `npm run lint` fails: `'eslint' is not recognized as an internal or external command` | Add `eslint` to `package.json` devDependencies and run `npm install`. Without this, code quality checks cannot be enforced. |
| 6 | **Medium** | Documentation | README claims "all checks pass" but tests fail | `README.md:6-7` states: "All checks pass — `npm test`, `npm run lint` and `npm run build` are green on every commit." Current test run shows 3 of 4 tests failing, lint/build cannot execute. | Update README to accurately describe the current project state, or fix all failing checks and confirm they pass before updating the claim. The statement is demonstrably false as-written. |

## Unconfirmed Issues

None. All findings are confirmed through direct command execution and code inspection.

## Summary

### Strengths

1. **Clear logic structure**: The core discount calculation is straightforward and readable. The separation of tier-based rate and loyalty bonus is logically clean (`src/discount.js:4-8`).

2. **Test-driven approach**: The project includes a test suite that correctly specifies the intended behavior, making it easy to identify and verify the correctness bugs once fixed.

### Key Risks

**Critical path broken (Finding #1)**: The discount calculation fails at its boundary condition (orders at exactly the threshold), which is likely a common case in practice. Customers at or above 10,000 units receive incorrect 5% discounts instead of 10% until the comparison operator is fixed.

**Build pipeline incomplete (Findings #2, #4, #5)**: Three declared npm commands fail. The project cannot be built, linted, or tested via the declared scripts. This is especially concerning given the README's assertion that "all checks pass on every commit" — the current state contradicts this.

**Time-bomb in business logic (Finding #3)**: The hardcoded reference date guarantees that the loyalty bonus calculation will break after 2026-09-01. This needs immediate refactoring to use a dynamic date or accept a date parameter.

**Misleading documentation (Finding #6)**: The README falsely claims project health, which undermines confidence in the codebase.

### Priority Order

1. **Fix threshold comparison (Finding #1)** — Severity: High, Effort: Trivial (1-character fix). Unblocks tests immediately.

2. **Fix hardcoded date (Finding #3)** — Severity: High, Effort: Low. Must be addressed before production to prevent latent failures.

3. **Restore build script (Finding #2)** — Severity: High, Effort: Medium (depends on intended build output). Required for deployment pipeline.

4. **Set up ESLint (Findings #4, #5)** — Severity: Medium, Effort: Low. Required for code quality enforcement.

5. **Update README (Finding #6)** — Severity: Medium, Effort: Trivial. Update documentation once other fixes are in place.

### Coverage Gaps

- **Integration testing**: Not examined. No tests for interaction with external systems or APIs (if applicable).
- **Performance testing**: No load testing or performance benchmarks were run.
- **Security review**: Input validation and edge cases around numeric overflow/underflow not examined in depth.
- **Type safety**: No TypeScript or JSDoc type annotations. Static type checking is unavailable.
- **Deployment and runtime configuration**: CI/CD pipeline, environment variable handling, and production deployment process not reviewed.
- **Dependency audit**: `npm audit` was not run (npm and dependencies appear to not be installed locally). Known vulnerability scan unavailable.

---

## What Was Verified

- Project structure and file inventory
- Execution of all three declared npm scripts (test, lint, build)
- Line-by-line source code review of `discount.js` and `discount.test.js`
- Root cause analysis of test failures through manual calculation trace
- Confirmation that README accuracy claim is contradicted by actual test results
- Verification that declared configuration files (.eslintrc.json, scripts/build.js) do not exist
