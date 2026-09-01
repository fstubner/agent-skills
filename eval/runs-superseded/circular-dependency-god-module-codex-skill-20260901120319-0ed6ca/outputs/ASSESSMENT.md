# Engineering Assessment: `orders-core`

## Scope and depth

Depth: **targeted**. I examined every package file currently present in the
workspace:

- `package.json`
- `README.md`
- `src/customers.js`
- `src/pricing.js`
- `src/util.js`
- `test/pricing.test.js`

In-scope concerns were reuse readiness, correctness, reliability,
maintainability, module boundaries, tests, and declared tooling. No code was
changed by this assessment.

## Domain and platform

This is a small, dependency-free Node.js ES module package for order pricing,
customer lookup, and shared synchronous utilities. It targets a server/CLI
JavaScript runtime; `package.json` declares Node's native test runner and no
build or lint framework.

## What I ran

Commands were run before writing findings:

- `npm test` — passed: 2 tests, 2 passed, 0 failed.
- `npm run build` — could not run: `package.json` has no `build` script.
- `npm run lint` — could not run: `package.json` has no `lint` script.
- `npm audit --audit-level=moderate` — could not run: no lockfile exists (`ENOLOCK`).
- `node --check src/pricing.js && node --check src/customers.js && node --check src/util.js` — passed (the command was chained after the audit command and produced no syntax errors).
- Runtime probe for `chunk([1], 0)` — terminated by `timeout` with exit 124, demonstrating non-termination.
- Runtime probes for invalid dates, negative money, and zero-attempt retry — output:

  ```text
  parseDate-invalid { year: 2026, month: 2, day: 30 }
  formatMoney-negative -1.-1
  retry-zero undefined thrown
  ```

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Reliability | `chunk` can hang indefinitely for a zero size. | `src/util.js:29-32` increments `i` by `size`; with `size === 0`, `i` never changes. The runtime probe timed out with exit 124. | Validate that `size` is a positive finite integer and throw a clear `RangeError` before entering the loop. Add a regression test. |
| 2 | Medium | Architecture | The shared utility module participates in a circular dependency with both domain modules. | `src/util.js:2-3` imports `priceFor` and `findCustomer`; `src/pricing.js:1` and `src/customers.js:1` both import `util.js`. | Split foundational pure helpers (`isWeekend`, `slugify`, formatting/parsing) into a dependency-free module. Keep orchestration such as `describeOrder` in a higher-level module so reusable consumers do not inherit a cycle. |
| 3 | Medium | Correctness | Date parsing accepts malformed or calendar-invalid input and silently normalizes it when determining weekends. | `src/util.js:18-26` uses unchecked `split`/`Number` values and constructs `Date`; the probe showed `parseDate('2026-02-30')` returns `{ year: 2026, month: 2, day: 30 }`. `src/pricing.js:6` uses the result in pricing. | Validate the exact `YYYY-MM-DD` format and round-trip the UTC date components before accepting it; reject invalid dates explicitly and test pricing behavior for invalid input. |
| 4 | Medium | Correctness | `formatMoney` produces invalid output for negative minor units. | `src/util.js:5-6`; the probe showed `formatMoney(-1)` returns `-1.-1`. | Define whether negative amounts are supported. If so, format the sign separately and use the absolute minor remainder; otherwise reject negatives. Add boundary tests for `-1`, `0`, and values below one currency unit. |
| 5 | Medium | Reliability | `retry` has an undefined-error failure mode when `times` is zero or negative. | `src/util.js:35-40`; no loop iteration leaves `last` undefined, and the probe showed `retry(..., 0)` throws `undefined`. | Validate `times` as a positive integer (or define an explicit zero-attempt contract) and throw a meaningful error. Also document whether retries include the initial invocation and whether async functions are supported. |
| 6 | Medium | Test coverage | Only the pricing happy paths are tested; shared helpers and customer behavior have no automated coverage. | `test/pricing.test.js:5-11` contains exactly two tests, both calling `priceFor`; no tests exercise `customers.js` or the seven helpers in `util.js`. | Before extraction, add focused tests for customer fallback/slugification, date validation and timezone boundaries, money formatting, chunk size validation, retry exhaustion/zero attempts, and `describeOrder`. |
| 7 | Medium | Maintainability | Public behavior and units/contracts are under-documented for a package intended for reuse. | `README.md:3-6` only names the modules and says `util.js` contains everything shared; exported functions in `src/customers.js`, `src/pricing.js`, and `src/util.js` have no API contracts or input-unit documentation. | Replace the broad `util.js` description with a small API reference documenting parameters, return values, errors, currency minor-unit semantics, date format, and sync-only behavior. |
| 8 | Low | Maintainability | The package entry point is `src/util.js`, which exposes a mixed internal aggregation layer rather than a deliberate public API. | `package.json:4` sets `"main": "src/util.js"`; that file exports unrelated formatting, order description, date, collection, and retry functions. | Define an explicit public entry module with stable exports, or provide documented subpath exports. Avoid making the cyclic orchestration module the default package surface. |

## Strengths

- The pricing behavior has a minimal, fast native test suite: `npm test`
  passed both weekday and weekend surcharge cases.
- The implementation has no runtime dependencies (`package.json` contains no
  `dependencies`), reducing installation and supply-chain surface.
- Date calculations use UTC (`src/util.js:25`), which avoids host-local timezone
  variation for the intended date-only weekend calculation.

## Key risks

The highest immediate extraction risk is the non-terminating `chunk` behavior
(Finding 1). The circular module graph (Finding 2) makes reuse and future
bundling more fragile. Input-contract gaps and the very narrow test suite
(Findings 3–7) mean consumers can receive silently wrong prices or malformed
utility output without a failing check.

## Priority order

1. Add argument validation and tests for `chunk`, date parsing, money
   formatting, and retry (Findings 1, 3–5).
2. Expand tests to cover all exported behavior and customer fallbacks (Finding
   6).
3. Break the `util.js` cycle and establish a dependency-free foundation module
   (Finding 2).
4. Publish an explicit API contract and entry point for reuse (Findings 7–8).
5. Add a lockfile and configure the intended lint/build checks if this package
   will be consumed through a standard release pipeline.

## Unconfirmed / Requires Investigation

- Whether callers rely on permissive date strings, negative amounts, zero-size
  chunking, or zero-attempt retry cannot be determined from this workspace;
  consumer repositories and production usage were not available.
- Whether `retry` is expected to support asynchronous functions is unknown;
  its current synchronous implementation does not await returned promises.
- The operational impact of malformed inputs depends on the package's future
  caller and validation boundary.

## Coverage gaps

- No consumer applications, deployment configuration, CI configuration,
  release process, production metrics, or runtime Node version policy were
  available in the enumerated scope.
- No load, concurrency, fuzz, penetration, or integration testing was
  performed.
- Build and lint could not be assessed because scripts are absent.
- Dependency vulnerability auditing could not be completed because there is
  no lockfile; there are no declared runtime dependencies to audit in
  `package.json`.
- Git history and sibling artifacts were not examined.
