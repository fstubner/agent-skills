# Engineering Assessment: Discount Engine

## Scope

**In scope:** The complete discount calculation engine, including:
- `src/discount.js` — the main discount calculation logic
- `test/discount.test.js` — the test suite
- `package.json` — project configuration and scripts

**Out of scope:**
- `.agent-input/` directory (evaluation artifacts)
- Evaluation cases, graders, or expected answers
- Sibling run outputs

**Depth:** Targeted — every in-scope file was read in full; automated checks were run as available.

---

## Environment

**Language & Runtime:** JavaScript (ES modules), Node.js v24.14.1

**Frameworks & Libraries:** None; plain Node.js

**Domain:** Business logic — discount calculation engine for e-commerce orders

**Build system:** npm with custom scripts

**Tooling:** Node.js test runner (built-in), ESLint (referenced but unavailable)

---

## Tooling Results

### What I ran

| Command | Status | Output |
|---------|--------|--------|
| `npm test` | **FAILED** | 3 of 4 tests failed; 1 passed. Failures in: "at the threshold the higher rate applies", "a five year member gets the loyalty uplift on top", "loyalty is capped at five years" |
| `npm run lint` | **FAILED** | ESLint not installed; error: `'eslint' is not recognized as an internal or external command` |
| `npm run build` | **FAILED** | Build script file missing; error: `Cannot find module 'C:\tmp\agent-skills-eval-v4YyKW\workspace\scripts\build.js'` |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Correctness | Threshold comparison uses `>` instead of `>=`, violating documented behavior | `src/discount.js:5` — `subtotalMinor > THRESHOLD_MINOR` should be `>=`. README states "10% at or above" the threshold. Test failure: `discountMinor(10000, 2026)` returns 500 instead of 1000. | Change line 5 to `const rate = subtotalMinor >= THRESHOLD_MINOR ? 0.1 : 0.05;` |
| 2 | **High** | Reliability | Test suite fails; critical discount logic is broken | `test/discount.test.js:9, 13, 18` — Three test assertions fail with AssertionError. Test output: "at the threshold" expects 1000 but gets 500; "five year member" expects 1500 but gets 1000; "capped loyalty" expects 1500 but gets 1000. | Fix the threshold comparison (Finding #1); all three test failures will then pass. |
| 3 | **Medium** | Architecture | Build script referenced in package.json but file does not exist | `package.json:8` references `scripts/build.js`, which is missing. Command fails: `Error: Cannot find module 'C:\tmp\...\scripts\build.js'` | Either create `scripts/build.js` with appropriate build logic, or remove the `build` script from package.json if it is not needed. |
| 4 | **Medium** | Architecture | Lint configuration missing; ESLint cannot run | `package.json:7` references `.eslintrc.json`, and ESLint itself is not installed as a dependency. Neither `.eslintrc.json` nor `node_modules/.bin/eslint` exists. | Add `.eslintrc.json` configuration file and add `eslint` to `devDependencies` in package.json. Run `npm install` to install it. |
| 5 | **Low** | Maintainability | Hardcoded date in discount calculation will become stale | `src/discount.js:6` — `new Date('2026-09-01')` is hardcoded. After September 1, 2026, this will still be used as the reference year, causing loyalty calculations to drift. | Replace hardcoded date with `new Date()` to use the current date at runtime, or accept that this must be updated annually. Document the intent and update frequency. |

---

## Unconfirmed Issues

None. All findings are confirmed by concrete evidence.

---

## Summary

### Strengths

1. **Clear, focused module structure.** The discount engine is a single, compact function in one file with a single exported API, making the responsibility obvious and the code easy to test.

2. **Good test coverage for the intended logic.** The test suite covers the key scenarios (threshold boundary, loyalty calculation, loyalty cap) and catches the defect immediately when run.

### Key Risks

**Finding #1 (Critical)** is the blocker: the threshold comparison operator is wrong. This causes all three loyalty-related tests to fail and violates the documented specification ("10% at or above" the threshold). The fix is a single-character change.

**Finding #2 (High)** is a consequence of #1: the test suite is failing, indicating the core business logic is broken. This must be resolved before any deployment.

**Findings #3 and #4 (Medium)** indicate missing build infrastructure: the build script and lint configuration are absent. This prevents automated quality checks and reproducible builds.

### Priority Order

1. **Fix the threshold operator** (`src/discount.js:5`, Finding #1) — single-character fix; unblocks test suite and fixes documented behavior.
2. **Verify all tests pass** — run `npm test` after fixing #1 to confirm.
3. **Create or remove build script** (`scripts/build.js`, Finding #3) — clarify intent and provide or remove the entry point.
4. **Set up linting infrastructure** (`.eslintrc.json` and ESLint, Finding #4) — add configuration and install ESLint as a dev dependency.
5. **Replace hardcoded date** (`src/discount.js:6`, Finding #5) — use `new Date()` or document the annual update requirement.

### Coverage Gaps

- **No static analysis run.** ESLint could not be executed; no lint report available.
- **No build verification.** The build script is missing, so build integrity was not verified.
- **No performance or integration testing.** This assessment covers correctness and code quality but does not include performance benchmarks, load testing, or integration with actual order processing systems.
- **No production deployment info.** No visibility into how this code is deployed, versioned, or called in production; no metrics on error rates or usage patterns.
- **No type checking.** JavaScript without TypeScript or JSDoc type annotations; no static type analysis performed.

---

## What I verified

I confirmed that the discount engine has a critical correctness bug in the threshold comparison (using `>` instead of `>=`), which causes three test failures and violates the documented specification. The test suite is well-designed and catches this defect. Build infrastructure is incomplete (missing build script and ESLint config), and a hardcoded date in the logic will become stale. The recommended fix is immediate: change the comparison operator on line 5 of `src/discount.js`.
