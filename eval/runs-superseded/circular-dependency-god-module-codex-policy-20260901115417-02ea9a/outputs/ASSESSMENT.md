# Reuse assessment: `orders-core`

## Summary

This is a small, readable ES-module package with a narrow amount of domain logic, but it is not ready to split out as a reusable package without first agreeing on its public contract. The current package boundary is accidental: `main` points to `src/util.js`, which is both a utility collection and an aggregator of pricing/customer behavior. The package also lacks a version and currently cannot be packed by npm.

Recommendation: treat the current source as an internal prototype. Before extraction, define the supported entry points and input/error semantics, then make the smallest compatible packaging and validation changes. Preserve existing behavior only where it is explicitly intended.

## Observed structure and behavior

- `src/pricing.js` exports `priceFor(order)`, using a base price of 2500 minor units per quantity and a 500-unit weekend surcharge.
- `src/customers.js` exports `findCustomer(id)` and `customerSlug(id)`, backed by a hard-coded in-memory customer list.
- `src/util.js` exports formatting, order description, slugging, date parsing, weekend detection, chunking, and retry helpers. It imports pricing and customers while those modules import util, creating a circular module dependency.
- `package.json` declares ESM and `src/util.js` as `main`, but has no `version`, `exports`, `files`, engines, build script, lint/type-check script, or package-level API documentation.
- The only automated tests cover two successful pricing cases. There are no tests for customers, utilities, integration through the declared entry point, or failure paths.

## Reuse risks

### Public API and module boundaries

The `main` entry point exposes an implementation file containing unrelated helpers and does not clearly expose pricing or customer modules as stable API. The circular dependency works for the current calls, but makes initialization order and future refactoring fragile. Consumers importing the package root would receive a different, undocumented API from consumers importing the individual source files.

The package name suggests a reusable core, while the hard-coded customer records and order-specific pricing policy suggest application-specific behavior. It is unclear whether customer lookup is intended to be extensible, injectable, or merely a demo fixture.

### Input and failure behavior

- `priceFor` does not validate that `order`, `quantity`, and `date` exist or have valid types/ranges. It can return `NaN` or misleading totals for malformed input.
- `parseDate` accepts malformed calendar values and does not verify that the parsed date round-trips to the supplied value. JavaScript date normalization can therefore classify invalid dates as another weekday/weekend.
- `formatMoney` assumes a non-negative integer minor-unit value; negative values produce incorrect-looking formatting because the remainder is negative.
- `chunk(rows, size)` does not validate `size`; a zero or negative size can result in a non-terminating loop.
- `retry(fn, times)` silently returns `undefined` for zero attempts and only supports synchronous functions. It also does not define which errors are retryable or whether delay/backoff is required.
- Unknown customer IDs are converted to a fabricated `Unknown` customer rather than rejected or represented explicitly. That may hide authorization or data-integrity mistakes if this crosses a trust boundary.

These behaviors should be specified before extraction. If inputs originate outside trusted application code, validation and authorization belong at the boundary rather than being assumed by these helpers.

### Packaging and operations

`npm pack --dry-run` fails with `Invalid package, must have name and version`, so the current metadata is not publishable. There is no declared Node compatibility range, no explicit export map, and no build step. The source-only layout may be acceptable for a private internal dependency, but that is an unresolved distribution choice.

There are no dependency or supply-chain concerns in the current source, and no database or migration surface. Additive data-change policy is therefore not currently applicable; it will matter if the hard-coded customer data becomes externally stored.

## Test and verification assessment

Verified on Node `v22.12.0` and npm `10.9.0`:

- `npm test`: passes 2/2 tests.
- Root-module smoke import succeeds and `describeOrder({ customerId: 'c1', quantity: 2, date: '2026-09-05' })` returns `Ada Fielding: 55.00`.
- `npm pack --dry-run`: fails because `package.json` has no version.

Before reuse, add focused tests for:

- malformed orders, zero/negative/non-integer quantities, invalid dates, and money limits;
- `formatMoney` negative and large values;
- `chunk` invalid sizes and empty inputs;
- retry exhaustion, zero attempts, thrown values, and intended async behavior;
- known and unknown customers and root-entry-point imports;
- weekend behavior around UTC/date-boundary expectations.

## Material unknowns to resolve

1. Which functions are the supported public API, and is the package root the only supported import path?
2. Is pricing fixed application policy, or should base price, surcharge, currency, and customer data be configurable?
3. What Node versions and distribution target are required (private workspace, npm package, or bundled artifact)?
4. Should malformed input throw, return a result type, or be rejected by a higher-level boundary?
5. Is `retry` intended to support asynchronous operations, delays, cancellation, or selective retries?

## Extraction plan

After resolving those unknowns, separate domain modules from generic utilities, remove the circular dependency, add an explicit root entry point/export map, add a valid version and compatibility metadata, and expand failure-path tests. Run the product (or a representative consumer), tests, and packaging/build checks before calling the split complete.
