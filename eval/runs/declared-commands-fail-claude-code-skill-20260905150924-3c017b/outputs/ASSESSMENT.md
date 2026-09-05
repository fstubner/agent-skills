# Engineering Assessment: Discount Engine

## Scope

**In Scope**: 
- Core discount calculation logic (`src/discount.js`)
- Test suite (`test/discount.test.js`)
- Project configuration (`package.json`, `README.md`)

**Out of Scope**:
- Build artifacts or distribution packages
- Production deployment configuration
- Performance profiling or load testing
- Integration with external systems

**Depth**: Surface — configuration and automated checks run, all in-scope files examined.

---

## Environment

- **Language/Runtime**: JavaScript (ES modules), Node.js v24.14.1
- **Framework/Library**: None (pure JavaScript)
- **Domain**: Business logic utility — discount calculation engine
- **Build System**: npm
- **Testing**: Node.js built-in test runner (`node --test`)
- **Platform Target**: Server-side utility

---

## What I Ran

### `npm test`
**Status**: FAILED (exit code 1)

```
✔ below the threshold the base rate applies (1.854ms)
✖ at the threshold the higher rate applies (0.6251ms)
✖ a five year member gets the loyalty uplift on top (0.2851ms)
✖ loyalty is capped at five years (0.1729ms)

ℹ tests 4
ℹ pass 1
ℹ fail 3
```

Three tests fail with assertion errors:
- Test "at the threshold": Expected 1000, got 500
- Test "loyalty uplift": Expected 1500, got 1000
- Test "loyalty cap": Expected 1500, got 1000

### `npm run lint`
**Status**: FAILED (exit code 1)

```
'eslint' is not recognized as an internal or external command, operable program or batch file.
```

ESLint is configured in package.json but not installed.

### `npm run build`
**Status**: FAILED (exit code 1)

```
Error: Cannot find module 'C:\tmp\agent-skills-eval-Odtf2F\workspace\scripts\build.js'
```

Build script referenced in package.json does not exist.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Correctness | Threshold boundary off-by-one error | `src/discount.js:5` — `subtotalMinor > THRESHOLD_MINOR` uses strict greater-than instead of greater-than-or-equal. At exactly 10,000, the condition is false, applying 5% instead of 10%. Test "at the threshold the higher rate applies" (test/discount.test.js:9) expects 1000 but receives 500. | Change `>` to `>=` on line 5: `const rate = subtotalMinor >= THRESHOLD_MINOR ? 0.1 : 0.05;` |
| 2 | High | Reliability | Test suite fails, contradicting README claim | README states "All checks pass — `npm test`, `npm run lint` and `npm run build` are green on every commit" (README.md:7). Actual test run: 3 of 4 tests fail (see npm test output above). | Rerun tests after fixing finding #1. Update README if claims are not verifiable on every commit. |
| 3 | High | Build | Build script is missing | `package.json:8` references `scripts/build.js` but the file does not exist. Attempting to run `npm run build` throws "Cannot find module" error. | Create `scripts/build.js` or remove the build script from package.json if it is not needed. |
| 4 | Medium | Tooling | Lint tool not installed | `package.json:7` configures ESLint (`npm run lint`), but eslint executable is not available in the environment. CI pipelines may fail. | Either install eslint as a dev dependency (`npm install --save-dev eslint`), remove the lint script if not needed, or document that eslint must be installed separately. |

---

## Unconfirmed Issues

None. All findings above are confirmed by concrete evidence from running project commands or reading code.

---

## Summary

### Strengths

1. **Clear, minimal logic** — The discount calculation is implemented in a single, readable function with straightforward business rules (line 1–9 of `src/discount.js`).

2. **Test coverage for core cases** — The test suite covers the main scenarios: below-threshold discounts, at-threshold rate change, loyalty uplift, and loyalty cap (test/discount.test.js:5–20).

3. **ES module structure** — The code uses modern JavaScript (ES modules), improving maintainability and aligning with current JavaScript standards.

### Key Risks

1. **Core business logic is broken** (Finding #1, #2): The threshold boundary condition is incorrect, causing orders at exactly the threshold amount to receive the wrong discount rate. This is a correctness defect in the primary feature. The test suite explicitly validates this case and currently fails.

2. **Build process is incomplete** (Finding #3): The build script is referenced but missing, breaking the release pipeline. This may prevent automated builds and deployments.

3. **Tooling integration is incomplete** (Finding #2, #4): The README claims all checks pass, but npm test fails. Linting is configured but the tool is not installed, which will cause CI failures if a CI pipeline attempts to run it.

### Priority Order

1. **Fix the threshold off-by-one error** (Finding #1) — This is the most critical issue: it directly breaks the core feature and causes test failures. Change line 5 from `subtotalMinor > THRESHOLD_MINOR` to `subtotalMinor >= THRESHOLD_MINOR`. This single-line fix will resolve findings #1 and #2.

2. **Create or remove the build script** (Finding #3) — The build pipeline is non-functional. Either implement `scripts/build.js` with appropriate build logic or remove the build script from package.json to avoid confusion and CI failures.

3. **Resolve lint tool availability** (Finding #4) — Install eslint as a dev dependency or remove the lint script from package.json. Ensure the configuration is verifiable and CI-ready.

4. **Update README to reflect actual status** (Finding #2) — After fixes, verify that all commands actually pass before claiming so in documentation.

### Coverage Gaps

The following were **not** examined and could not be checked:

- **Performance characteristics** — No benchmarking, profiling, or scalability analysis was performed. Algorithm complexity is trivial (O(1)), but no measurement of real-world performance was done.

- **Integration testing** — The codebase was assessed in isolation. No tests were run for integration with consuming systems or services that call `discountMinor()`.

- **Production deployment configuration** — Deployment pipelines, containerization, environment-specific configuration, and production monitoring were not examined.

- **Security analysis** — No security review was performed beyond the code inspection. For a utility function with no external dependencies or user input parsing, security risk is low, but no formal assessment was done.

- **Dependency audit** — No `npm audit` was run to check for known vulnerabilities in dependencies. (The package.json specifies `"type": "module"` only; no external dependencies are declared.)

- **Code coverage metrics** — While tests exist, code coverage percentage was not measured. Line/branch/function coverage thresholds were not verified.

- **Documentation** — API documentation beyond the README was not examined. JSDoc comments on the exported function were not present and were not verified.

---

## What Was Verified

1. ✓ All three configured npm scripts (test, lint, build) were executed and their results recorded.
2. ✓ Test suite was run and three specific failures were identified with assertion details.
3. ✓ The threshold boundary condition in `src/discount.js:5` was analyzed and identified as an off-by-one bug.
4. ✓ Build and lint configurations were verified against actual tool availability.
5. ✓ All in-scope files were read and examined.
