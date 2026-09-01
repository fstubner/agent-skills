# Reuse assessment: `orders-core`

## Summary

This package is a workable prototype, but it is not yet a clean reusable
library boundary. The pricing and customer functions are small and easy to
extract; the current `util.js` entry point and its dependency cycle should be
resolved before splitting the package out. The package also needs a deliberate
public API, input-contract decisions, and broader tests.

## What is present

- `priceFor(order)` calculates a base price of 2,500 minor units per item and
  adds a 500-unit weekend surcharge.
- `findCustomer(id)` and `customerSlug(id)` provide access to a hard-coded
  customer list, with an “Unknown” fallback.
- `formatMoney`, `describeOrder`, `slugify`, date helpers, `chunk`, and
  `retry` live together in `src/util.js`.
- The package is ESM (`"type": "module"`) and has a Node test script.

## Findings

### High priority: package boundary and dependency structure

`package.json` declares `src/util.js` as `main`, so consumers receive only the
exports from the helper module. They cannot import pricing or customer APIs
through a documented package entry point. There is also no `exports` map or
browser/runtime declaration.

The dependency graph is circular:

`util.js` imports `pricing.js` and `customers.js`; both import helpers from
`util.js`. Current smoke usage works because the imported functions are called
after module initialization, but this is fragile and makes independent
extraction, testing, and tree-shaking harder. Move foundational helpers (for
example date and slug functions) into dependency-free modules, then have
pricing, customers, and presentation code depend one way on them.

`util.js` mixes domain behavior (`describeOrder`), formatting, parsing, batch
processing, and retry behavior. It should not remain the reusable package
boundary. Split by responsibility and expose an intentional top-level API.

### High priority: contracts and validation

The functions rely on implicit input contracts. `priceFor` does not validate
that `order`, `quantity`, or `date` exists or that quantity is a finite,
non-negative integer. Invalid values can produce `NaN`, negative prices, or
runtime errors. `parseDate` accepts malformed and calendar-invalid strings,
and `isWeekend` can therefore operate on surprising dates.

`chunk(rows, size)` has no size validation. A size of zero or a negative size
does not advance the loop and can run indefinitely; non-integer sizes also
have unclear behavior. `retry(fn, times)` similarly has no contract for zero,
negative, or non-integer attempts and throws `undefined` when no attempt runs.
Decide whether these helpers belong in this package; if retained, define and
test their error behavior.

`formatMoney` assumes a non-negative integer minor-unit amount and does not
handle negative values or non-integers explicitly. Naming the unit in the API
(such as `minorAmount`) would make the currency contract clearer; currency and
rounding policy are currently implicit.

### Medium priority: data ownership and extensibility

Customers are an in-memory constant, so reuse across applications would mean
shipping application-specific data and a fixed unknown-customer policy. Make
the customer source injectable or accept a repository/map, and specify whether
unknown IDs should return a sentinel or raise an error. Avoid exposing mutable
internal records if this becomes a shared dependency.

`priceFor` hard-codes rates and the weekend rule. Reuse will be limited unless
the pricing policy/rates are configuration or explicitly documented as this
package’s business rule. The date calculation uses UTC, which is deterministic,
but the timezone and date-string format should be part of the contract.

### Medium priority: verification and release readiness

The only automated tests cover two pricing cases. There are no tests for
customers, formatting, date parsing, slugification, `describeOrder`, chunking,
retry behavior, invalid input, module entry points, or the circular import.
Add focused unit tests and at least one public-entry-point smoke test before
publishing.

`README.md` documents the broad purpose but not installation, imports, API
signatures, units, supported Node versions, error behavior, or configuration.
`package.json` has no version, license, repository metadata, engines field,
build declaration, or package export map. Add the metadata and publish
inclusion rules appropriate to the target registry.

## Recommended extraction shape

1. Create dependency-free modules for date validation/weekend calculation,
   money formatting, slugification, and generic collection/retry utilities
   (only retain the generic utilities if they are truly in scope).
2. Make `pricing.js` and `customers.js` depend on those lower-level modules,
   never on an aggregate helper module.
3. Decide whether `describeOrder` is domain presentation logic; if retained,
   place it in a separate composition module.
4. Add `src/index.js` with the supported exports and an `exports` map in
   `package.json`; document the same API in the README.
5. Define validation, units, timezone, unknown-customer, retry, and failure
   semantics, then test those contracts.

## Verification performed

`npm test` passes: 2 tests passed. A direct ESM import of `src/util.js` exposed
seven helper exports and successfully exercised `describeOrder` and normal
chunking. Static usage inspection found that `chunk` and `retry` have no
in-repository callers, and a zero-size chunk call failed to terminate during
the smoke check, confirming the need for input validation.

