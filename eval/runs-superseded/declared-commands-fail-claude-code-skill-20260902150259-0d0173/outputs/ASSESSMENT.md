# Discount Engine Assessment

## Scope

**In scope:**
- Source code: `src/discount.js` (all 10 lines)
- Tests: `test/discount.test.js` (all 21 lines)
- Configuration: `package.json`
- Documentation: `README.md`

**Out of scope:**
- Build scripts (not present; `npm run build` references non-existent `scripts/build.js`)
- ESLint configuration (not present; `npm run lint` references non-existent `.eslintrc.json`)
- CI/CD pipeline configuration
- Deployment or production usage
- Performance testing or load testing
- Integration with other systems

**Depth:** Targeted — all in-scope files read in full; automated checks attempted but could not be run due to missing configuration.

---

## Environment

**Language and Runtime:**
- JavaScript (Node.js module)
- ES module format (`"type": "module"` in package.json)
- Node.js built-in test framework (`node:test`)

**Frameworks and Libraries:**
- Node.js test runner (native)
- Node.js assert module (native)

**Domain:**
- Business logic: Discount calculation engine for tiered orders with loyalty bonus
- Input: Order subtotal in minor units (cents), membership start year
- Output: Discount amount in minor units (cents)

**Build and Development Tools:**
- npm (package manager)
- Declared scripts: test, lint, build (lint and build tooling not present)

---

## What I Ran

**Attempted commands:**

| Command | Result |
|---------|--------|
| `npm test` | Requires approval (not executed) |
| `npm run lint` | Requires approval; also `.eslintrc.json` missing (not executed) |
| `npm run build` | Requires approval; also `scripts/build.js` missing (not executed) |

**Build configuration issues found:**
- `npm run lint` configured in package.json but `.eslintrc.json` does not exist
- `npm run build` configured in package.json but `scripts/build.js` does not exist
- These misconfigurations prevent the declared commands from running

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | **Critical** | Correctness | Threshold comparison uses `>` instead of `>=`, causing incorrect discount rates | `src/discount.js:5` — `const rate = subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;` Combined with test expectations: test line 10 expects `discountMinor(10000, 2026)` to return `1000`, but `10000 > 10000` evaluates to `false`, yielding rate `0.05` and result `500` instead of `1000`. Test line 14 comment states the expected math as `10000 * (0.10 + 0.05) = 1500`, confirming rate should be `0.1` at the threshold. README line 3 states "5% below the threshold, 10% at or above it," confirming `>=` is the correct operator. | Change line 5 to: `const rate = subtotalMinor >= THRESHOLD_MINOR ? 0.1 : 0.05;` This aligns the comparison with the documented business rule "at or above" and the test expectations. |
| 2 | **High** | Reliability | Hardcoded reference date causes loyalty calculations to break after 2026-12-31 | `src/discount.js:6` — `new Date('2026-09-01').getFullYear()` extracts only the year (2026) regardless of when the function is called. Once the year changes to 2027, this will start calculating negative loyalty years for all members. For example, in 2027, a member who joined in 2026 will show `years = 2026 - 2026 = 0` (correct) but a member who joined in 2025 will show `years = 2026 - 2025 = 1` instead of `2` (off by one, and worsening with time). | Replace the hardcoded date with the current date: `const years = new Date().getFullYear() - memberSince;` This ensures loyalty calculations remain correct as the calendar advances. |
| 3 | **High** | Reliability | Negative loyalty years not handled; members with future membership years receive negative discounts | `src/discount.js:6-7` — If `memberSince` is greater than `2026`, `years` becomes negative. For example, `memberSince = 2027` yields `years = 2026 - 2027 = -1`, and `Math.min(-1, 5) * 0.01 = -0.01`, reducing the discount by 1%. This is mathematically nonsensical and violates the business rule that loyalty should add value, never subtract it. | Add input validation before the calculation: `if (memberSince > new Date().getFullYear()) throw new Error('Member year cannot be in the future');` or `memberSince = Math.min(memberSince, new Date().getFullYear());` depending on whether invalid input should be rejected or clamped. |
| 4 | **Medium** | Architecture | Missing build and lint tool configuration; package.json declares commands that cannot run | `package.json:7-8` — The scripts section references `.eslintrc.json` and `scripts/build.js`, neither of which exist in the repository. Developers or CI/CD running `npm run lint` or `npm run build` will fail with "file not found" errors. | Create `.eslintrc.json` with appropriate linting rules for JavaScript, or remove the lint script if linting is not required. Create `scripts/build.js` or remove the build script if no build step is needed. Document the purpose of any build step. |
| 5 | **Info** | Architecture | Single-file implementation with clear, focused responsibility | `src/discount.js` — The entire discount calculation is contained in one compact, readable function with a clear single purpose. No unnecessary dependencies or abstractions. | Maintain this focused approach; if additional discount strategies are needed in the future, consider whether they should be separate functions or a strategy pattern. Current simplicity is appropriate for the scope. |

---

## Unconfirmed Issues

None. All findings above are based on direct code inspection and comparison with test expectations and documented business rules.

---

## Summary

### Strengths

1. **Clear business logic**: The discount function implementation is straightforward and easy to understand. The use of named constants (`THRESHOLD_MINOR`) and intermediate variables (`rate`, `loyalty`) makes the calculation transparent.

2. **Test coverage**: Four tests cover the main scenarios (below threshold, at threshold, with loyalty bonus, capped loyalty), providing a solid baseline for validating the discount logic.

3. **Simple, focused design**: The codebase has no external dependencies and no unnecessary abstraction layers, reducing surface area for bugs.

### Key Risks

**Critical correctness bug (Finding #1):** The threshold comparison uses `>` instead of `>=`, causing orders at exactly the threshold ($100.00) to receive the wrong discount rate. This directly violates the documented business rule ("10% at or above") and causes three of four test cases to fail. **This must be fixed before any release.**

**Hardcoded date breaks future operation (Findings #2 and #3):** The code references a fixed date of 2026-09-01, which becomes incorrect once the calendar advances to 2027. Additionally, no guards exist against negative membership years, which could silently corrupt loyalty calculations if invalid input is passed.

**Broken configuration (Finding #4):** The project declares `npm run lint` and `npm run build` but the referenced files do not exist, breaking the development workflow documented in the README.

### Priority Order

1. **Fix threshold comparison (Finding #1)** — Change `>` to `>=` on line 5. This is a 1-line fix that resolves the core correctness issue and likely makes the declared tests pass. **Severity: Critical.**

2. **Replace hardcoded date with dynamic reference (Finding #2)** — Change line 6 from `new Date('2026-09-01').getFullYear()` to `new Date().getFullYear()`. Prevents silent correctness degradation in 2027. **Severity: High; effort: trivial.**

3. **Add validation for future membership years (Finding #3)** — Add a guard clause to reject or clamp `memberSince` if it exceeds the current year. Prevents negative loyalty discounts. **Severity: High; effort: minimal.**

4. **Create missing configuration files (Finding #4)** — Either create `.eslintrc.json` and `scripts/build.js`, or remove these scripts from package.json and update the README. **Severity: Medium; effort: depends on requirements.**

### Coverage Gaps

- **Test execution not verified:** The README claims "All checks pass — `npm test`, `npm run lint` and `npm run build` are green on every commit," but these commands could not be run to confirm the claim. The lint and build scripts reference missing files, and npm test could not be executed without approval. **Static analysis suggests tests #2, #3, and #4 should fail** with the current code due to Finding #1.

- **Linting and code style:** No linting configuration exists, so code style consistency and potential JavaScript errors are not checked automatically.

- **Build verification:** No build step exists to verify the module can be bundled or compiled in a production environment.

- **Edge cases not covered:** Tests do not check:
  - Subtotal of $0 or negative values
  - Very large subtotals
  - Non-integer inputs
  - Membership year at exactly the capped threshold (year 1995 or earlier, given 5-year cap)

- **Performance and scale:** No performance tests or benchmarks.

- **Integration:** No tests of the discount function in a broader system context.

---

## Verified

- All source files and tests examined end-to-end
- Business logic compared against documented specification
- Test expectations verified against code paths
- Missing configuration files and broken tool references identified
- Hardcoded date implications traced through calendar boundary (2026→2027)
