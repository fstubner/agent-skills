# Reuse assessment: `orders-core`

## Executive summary

This package is small and understandable, but it is not yet a clean reusable
package boundary. The pricing and customer functionality can be split out with
limited effort; the main work is separating shared primitives from
application/domain orchestration and defining an intentional public API.

**Recommendation:** suitable for extraction after a small boundary-design
pass. Do not publish the current package unchanged.

## What is present

- `src/pricing.js` exposes `priceFor(order)` and applies a fixed minor-unit
  base price plus a weekend surcharge.
- `src/customers.js` exposes `findCustomer(id)` and `customerSlug(id)` over a
  private in-memory customer list.
- `src/util.js` contains formatting, date, string, collection, retry, and
  domain-description functions.
- `package.json` declares an ES module package named `orders-core`; its `main`
  points to `src/util.js`.
- The only test file covers the weekday and weekend pricing cases.

## Boundary and dependency findings

### 1. `util.js` is not actually a utilities-only module

`describeOrder()` depends on both pricing and customers, while `pricing.js`
and `customers.js` each import helpers from `util.js`. This creates a cycle:

`util.js` → `pricing.js` → `util.js`

and another through `customers.js`. The current ESM implementation loads and
runs because the functions are called after module initialization, but the
cycle makes initialization order and future refactors fragile. It also means
that importing a basic helper pulls in domain modules.

The package should move genuinely shared primitives (for example,
`formatMoney`, `slugify`, `parseDate`, and `isWeekend`) into a dependency-free
module. `describeOrder` belongs in a domain/facade module that may depend on
pricing and customers, not in that primitive module.

### 2. The package entry point exposes an accidental API

`main` exposes `src/util.js`, so consumers receive the current collection of
utility and orchestration exports rather than a deliberate package surface.
There is no `exports` map, so consumers can also reach internal source paths.
Before reuse, define named entry points and document which functions are
stable. Decide whether pricing and customer data are one package or separate
submodules/packages.

### 3. Domain state and environment assumptions are embedded

Customer records are hard-coded and unknown IDs return a synthesized customer.
That may be appropriate for a demo, but a reusable package should either make
the customer source injectable or explicitly state that it is an in-memory
fixture implementation. Pricing constants are also hard-coded and there is no
configuration for currency, price, or surcharge policy.

`isWeekend` uses UTC to avoid local-time variation, which is deterministic, but
the accepted date format and invalid-date behavior are undocumented.

## API and correctness risks

- `priceFor` assumes `order.quantity` is a usable number and `order.date` is a
  valid `YYYY-MM-DD` string. Missing, fractional, negative, or malformed
  inputs are not validated.
- `formatMoney` is suitable for non-negative integer minor units, but negative
  values and values with a remainder outside the expected range are not
  specified.
- `parseDate` accepts impossible calendar dates without reporting an error;
  JavaScript date normalization can then produce surprising weekday results.
- `chunk` has no defined behavior for zero, negative, or non-finite sizes.
- `retry` retries every thrown error, has no delay/backoff or async support,
  and with zero attempts throws `undefined` rather than a useful error.
- `describeOrder` combines lookup, pricing, and presentation, which makes it
  harder to reuse in applications with different display or localization
  requirements.

These are not all blockers if the package is explicitly internal and trusted-
input only, but they should be part of the public contract if extracted for
general reuse.

## Test and release readiness

The existing test command passes: 2 tests pass. Coverage is narrow: it tests
only the pricing happy path and does not test the public entry point, customer
behavior, helper edge cases, module-cycle behavior, invalid inputs, or a
consumer-style package import. There is no visible build step, type contract,
lint configuration, package export contract, or versioning/release metadata.

Add contract tests before extraction, especially for boundary dates, invalid
inputs, unknown customers, money formatting, retry exhaustion, and the exact
exports intended for consumers. Test imports through the package entry point,
not only relative source paths.

## Suggested extraction shape

1. Create a dependency-free `shared` module for validated primitives.
2. Keep pricing policy in a pricing module that depends only on shared date
   behavior.
3. Keep customer lookup behind an explicit repository/provider interface (or
   clearly label the in-memory implementation as a fixture).
4. Put `describeOrder` in a higher-level orders module, or remove it from the
   reusable core if presentation is outside scope.
5. Add an explicit `exports` map and a documented public API; retain internal
   modules as non-public implementation details.
6. Add validation and tests that establish the behavior expected by external
   consumers.

## Verification performed

The repository contains the files described above, `npm test` passes with 2/2
tests, and importing `src/util.js` exposes seven functions and successfully
formats a weekend order. No source files were changed; this assessment file is
the only requested addition.
