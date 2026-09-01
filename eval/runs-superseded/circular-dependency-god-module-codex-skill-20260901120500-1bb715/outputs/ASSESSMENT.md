# Engineering Assessment: `orders-core`

## Scope and depth

Depth: **targeted**. I examined every file in the package source and test inventory, the package metadata, and the README. The assessment focuses on split-out reuse: package entry-point usability, module boundaries, public helper behavior, validation, and automated-check coverage.

In scope:

- `package.json`
- `README.md`
- `src/customers.js`
- `src/pricing.js`
- `src/util.js`
- `test/pricing.test.js`

The in-scope inventory was enumerated before reading: repository root, `src/`, and `test/`, with the six files above.

## Platform and domain

This is a dependency-free ECMAScript module package for Node.js. It contains order pricing, customer lookup, formatting, date helpers, chunking, and synchronous retry behavior. The package declares Node's built-in test runner and uses `src/util.js` as its package `main` entry point (`package.json:2-5`).

## What I ran

### `npm test` — passed

```text
> test
> node --test test/pricing.test.js
1..2
# tests 2
# pass 2
# fail 0
```

### `npm audit --omit=dev` — could not run

```text
npm error code ENOLOCK
npm error audit This command requires an existing lockfile.
```

### Entry-point and edge-case smoke check — completed

```text
chunk,describeOrder,formatMoney,isWeekend,parseDate,retry,slugify
true
not-a-date false 2500
2026-02-30 false 2500
```

The first line is the export list from `src/util.js`; the latter lines show `isWeekend`/`priceFor` behavior for a malformed and calendar-invalid date.

No build, lint, type-check, or format scripts are declared in `package.json`; no separate configuration for those tools was present in the enumerated package files, so those checks were not applicable/attempted.

## Confirmed findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Medium | Packaging / API | The package entry point does not expose the core pricing API. | `package.json:5` sets `main` to `src/util.js`; the entry-point smoke check exported only `chunk,describeOrder,formatMoney,isWeekend,parseDate,retry,slugify`, while `priceFor` is exported only from `src/pricing.js:5`. | Add a deliberate public entry module that re-exports the supported pricing, customer, and helper APIs, or document and configure supported subpath exports. Add a test importing the package entry point. |
| 2 | Medium | Architecture | The shared-helper module participates in a circular dependency with domain modules. | `src/util.js:2-3` imports `priceFor` and `findCustomer`; `src/pricing.js:1` imports `isWeekend` from `util.js`; `src/customers.js:1` imports `slugify` from `util.js`. | Move foundational helpers such as date and slug functions into a dependency-free module. Keep pricing and customer modules dependent on that foundation, and have the public entry module compose exports. |
| 3 | Medium | Correctness / Validation | Date and order inputs are not validated, so malformed dates silently receive weekday pricing and quantities can produce nonsensical results. | `src/util.js:18-26` converts arbitrary components with `Number` and constructs a `Date` without checking parseability or round-trip validity; the smoke check returned `false` for `not-a-date` and `2026-02-30`. `src/pricing.js:5-7` multiplies any `order.quantity` and reads `order.date` without checks. | Validate the date format and calendar validity, and validate that quantity is a finite, non-negative integer before calculating. Decide whether invalid input throws or returns a typed error, then test those contracts. |
| 4 | Medium | Reliability | `chunk` can fail to terminate when given a non-positive size. | `src/util.js:29-32` increments `i` by `size` in the loop; with `size === 0`, `i` never changes, and with a negative size the loop condition also remains true for non-empty input. | Reject non-positive or non-finite sizes before the loop with a clear error, and add boundary tests for empty input, size one, oversized size, zero, and negative values. |
| 5 | Medium | Maintainability / Testing | Automated coverage is limited to two pricing happy paths; the other exported behavior and the package boundary are untested. | `package.json:5` runs only `test/pricing.test.js`; that file contains two tests (`test/pricing.test.js:5-11`) and imports `pricing.js` directly, while `customers.js`, most of `util.js`, malformed inputs, and the package entry point are not exercised. | Add focused tests for customer fallback/slugging, money formatting, date validation, chunk/retry boundaries, circular-import initialization, and consumer imports through the package entry point. |

## Unconfirmed / Requires Investigation

- Dependency vulnerabilities and license compatibility are unconfirmed because no lockfile exists, causing `npm audit` to stop before analysis. Resolve the dependency policy and generate a lockfile in the intended consumer/release workflow before relying on audit results.
- Runtime support is unconfirmed. `package.json` does not declare an `engines` range, so the minimum supported Node.js version and whether all intended bundlers handle this ESM/circular-import arrangement require confirmation.
- Whether unknown customers are intentionally represented as `{ id, name: 'Unknown' }` is unconfirmed; `src/customers.js:8-10` provides no error or documented contract.

## Strengths

- The implementation is small and dependency-free: `package.json:1-5` contains only package metadata and a built-in Node test command, which is favorable for extraction.
- Pricing behavior is covered by passing executable tests for both weekday and weekend paths (`test/pricing.test.js:5-11`; `npm test` reports 2 passing tests).
- Date calculations use UTC (`src/util.js:25`), avoiding host-local timezone changes for the weekday calculation.

## Key Risks

The highest practical split-out risk is API ambiguity: the declared entry point hides `priceFor` (#1), while the `util.js` aggregation and circular imports make the intended layering unclear (#2). Independently, permissive inputs can silently produce incorrect prices (#3), and a bad chunk size can hang a caller (#4). The narrow test suite makes regressions in all of these areas easy to miss (#5).

## Priority order

1. Define and test the supported package entry-point API, including `priceFor`.
2. Separate dependency-free helpers from pricing/customer modules and remove the cycle.
3. Add explicit input contracts and validation for dates, quantities, and chunk sizes.
4. Expand tests around the public API and all exported helpers.
5. Establish a lockfile, supported Node.js range, and dependency/license audit policy.

## Coverage Gaps

- No production consumers, deployment configuration, runtime metrics, or package-publishing configuration were available in scope.
- No load, concurrency, fuzz, penetration, compatibility, or integration testing was performed.
- No build, lint, type-check, or format check was available from the package configuration.
- `npm audit` could not inspect dependencies because there is no lockfile.
- Evaluation cases, graders, expected answers, sibling run outputs, and any files outside the current package inventory were not examined.

