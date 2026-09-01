# Reuse assessment: `orders-core`

## Executive summary

This package is not ready to split out as a stable reusable package without a small boundary/API cleanup. The pricing and customer behavior is understandable and the existing pricing tests pass, but the package entry point is `src/util.js`, which is an internal helper module that imports both domain modules. That makes the dependency graph circular and exposes an accidental mixed API rather than a deliberate public surface.

Recommended disposition: **split only after establishing an explicit public entry point and separating low-level helpers from domain orchestration**. The implementation is small enough that this should be a low-to-moderate effort, but consumers should not be asked to depend on the current file layout.

## What is present

- `src/pricing.js`: exports `priceFor(order)`; uses a fixed base price of 2500 minor units and adds 500 minor units for weekend dates.
- `src/customers.js`: exports `findCustomer(id)` and `customerSlug(id)`; uses an in-memory customer list and an `Unknown` fallback.
- `src/util.js`: exports formatting, order-description, slugification, date parsing, weekend detection, chunking, and retry helpers.
- `package.json`: declares ESM, sets `src/util.js` as `main`, and runs only `test/pricing.test.js`.
- `README.md`: gives a one-line description and asserts that every helper in `util.js` is used.

## Findings

### High priority: package entry point is not a coherent public API

`package.json` points `main` at `src/util.js`, so package consumers receive the helper module only. They do not get `priceFor`, `findCustomer`, or `customerSlug` from the declared entry point. Consumers must know internal source paths to use the main domain functionality.

The entry point also exports unrelated helpers (`chunk`, `retry`, `parseDate`, etc.), with no documented stability or ownership policy. Before reuse, define and document an intentional export surface, likely through a dedicated entry module.

### High priority: circular module dependency

`pricing.js` imports `isWeekend` from `util.js`; `customers.js` imports `slugify` from `util.js`; and `util.js` imports `priceFor` and `findCustomer` to implement `describeOrder`. This cycle currently works for the exercised calls because the imports are used inside function bodies, but it couples every helper and domain module and makes initialization-sensitive future changes risky.

The cycle should be removed before extraction. Low-level helpers should not import domain modules; `describeOrder` belongs in a domain-facing module (or should compose injected functions).

### Medium priority: tests cover only one function

The two tests cover weekday/weekend pricing, but there are no tests for customers, order descriptions, formatting, date parsing, slugification, chunking, retry behavior, invalid inputs, or the package entry point. This leaves the effective reusable contract undefined and would make a split prone to unnoticed compatibility changes.

### Medium priority: input validation and edge-case behavior are implicit

`priceFor` assumes an order with numeric `quantity` and a parseable `date`; `parseDate` accepts malformed or out-of-range components without validation. `formatMoney` is designed for non-negative integer minor units but does not enforce that contract. `chunk` has undefined practical behavior for zero or negative sizes, and `retry` can throw `undefined` when called with zero attempts.

These may be acceptable internal assumptions, but a reusable package should either validate them or explicitly document them and test the chosen behavior.

### Medium priority: pricing policy is hard-coded

Base price and weekend surcharge are module constants, and the customer data is an in-memory constant. That is fine for a narrowly scoped library, but reuse requires deciding whether these are intentionally fixed policy, configurable options, or test-only fixtures. The current API provides no way to override them.

### Low priority: package metadata and documentation are incomplete

There is no version, exports map, files declaration, license, repository metadata, or documented Node compatibility range. The README does not document installation, imports, input/output shapes, units (minor currency units), error behavior, or supported date format. These omissions are manageable but should be addressed for publication or cross-repository consumption.

## Dependency and portability assessment

- Runtime dependencies: none outside the Node standard library.
- Module format: native ESM (`"type": "module"`). This is portable for modern Node consumers but should be stated as a requirement.
- Environment sensitivity: weekend calculation uses UTC, which is deterministic and portable; the date parser accepts only a superficially `YYYY-MM-DD`-shaped string and does not verify calendar validity.
- State: customer records are module-local and immutable by convention; there is no persistence or network coupling.
- Build step: none; source files are executed directly.

## Suggested extraction shape

1. Add a deliberate public entry module that exports only supported domain APIs.
2. Move pure helpers (`formatMoney`, `slugify`, date parsing/weekend detection, and possibly generic `chunk`/`retry`) into focused modules.
3. Place `describeOrder` in a domain module that imports pricing and customer APIs, eliminating the cycle.
4. Decide and document validation, currency-unit, date, retry, and unknown-customer semantics.
5. Expand tests around the public entry point and each supported behavior, including representative invalid inputs.
6. Add package metadata and publish-consumer checks before releasing the split package.

## Verification performed

`npm test` was run successfully: 2 tests passed, 0 failed. A direct ESM import of the declared entry point was also checked; it exposes seven helper/domain-composition exports and successfully formats a sample weekend order as `Ada Fielding: 55.00`. No implementation files were changed.
