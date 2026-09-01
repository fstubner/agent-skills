# Reuse assessment: `orders-core`

## Executive assessment

This is a small, understandable ESM package, but it is not ready to split out as a reusable package without a boundary-hardening pass. The pricing behavior demonstrated by the current tests is straightforward; the bigger risks are an accidental public API, circular module ownership, implicit input contracts, and insufficient release metadata and test coverage.

Recommendation: extract only after agreeing on the intended public API and input/error semantics. A minimal viable extraction should first establish an explicit entry point, package metadata, validation at exported-function boundaries, and focused tests for invalid and boundary inputs.

## Findings

### High priority

1. **The package boundary is accidental.** `main` points directly to `src/util.js` (`package.json:4`). That makes the catch-all helper module the package API while `priceFor`, `findCustomer`, and `customerSlug` are not exposed through a deliberate package entry point. There is no `exports` map, version, description, or repository/license metadata. `npm pack --dry-run` currently fails because the required `version` is missing.

2. **Module ownership is circular.** `util.js` imports `pricing.js`, `pricing.js` imports `util.js`, and `customers.js` imports `util.js` (`src/util.js:2-3`, `src/pricing.js:1`, `src/customers.js:1`). This happens to load under the current ESM runtime, but it couples unrelated domains and makes future initialization changes fragile. Shared primitives should be separated from domain functions, with a deliberate barrel/public entry point above them.

3. **Exported functions do not validate trust-boundary inputs.** `priceFor` assumes an object, numeric quantity, and valid date (`src/pricing.js:5-7`); `parseDate` accepts malformed dates and returns `NaN` fields (`src/util.js:18-20`); `isWeekend` permits date rollover because `Date.UTC` normalizes out-of-range values (`src/util.js:23-26`). Decide whether invalid input throws, returns a result type, or is otherwise rejected, then test that contract.

### Medium priority

4. **Several helper edge cases are undefined.** `formatMoney` behaves unexpectedly for negative values because `Math.floor` and the remainder are combined (`src/util.js:5-7`). `chunk` can loop forever for zero or negative `size` (`src/util.js:29-32`). `retry` with zero attempts throws `undefined`, and it has no contract for asynchronous functions or retryable errors (`src/util.js:35-41`). These helpers should either be narrowed, validated, or removed from the reusable API.

5. **Customer data is process-local and immutable by convention only.** The customer list is hard-coded (`src/customers.js:3-6`), and unknown IDs silently become an `Unknown` customer (`src/customers.js:8-10`). That may be suitable for a demo, but reuse requires an explicit data-source/configuration boundary and a documented unknown-customer policy.

6. **Pricing policy is embedded as constants and calendar logic.** The base price and weekend surcharge are fixed in module scope (`src/pricing.js:3-7`). Consumers cannot inject a policy, currency, or clock/calendar convention. Confirm whether this package is intended to encode one business policy or provide a generic pricing engine before extracting it.

### Low priority

7. **Documentation does not define a contract.** The README only describes the broad contents and asserts that everything in `util.js` is used (`README.md`). It does not document exports, units (minor currency), accepted date format, errors, supported Node versions, or examples.

8. **Automated coverage is narrow.** The only two tests cover weekday/weekend pricing with positive quantities (`test/pricing.test.js:5-12`). There are no tests for public imports, customer behavior, formatting, slugification, date validation, chunking, retry failure paths, zero/negative quantities, malformed orders, or package installation/packing.

## Recommended extraction sequence

1. Clarify the material contract: public functions, currency units, date validity/time-zone rules, quantity rules, unknown-customer behavior, sync/async retry semantics, and whether customer data is configurable.
2. Add a deliberate package entry point and `exports` map; include a valid version and supported-runtime metadata. Keep compatibility aliases only if existing consumers depend on the current `main` behavior.
3. Break the cycle by moving date, money, and generic collection/retry primitives into narrowly scoped modules. Keep pricing and customer modules dependent on primitives, not on a catch-all utility module.
4. Validate inputs at exported boundaries and make failure behavior consistent. Avoid silently normalizing malformed dates or unknown business data unless that is the specified policy.
5. Add focused tests for each agreed contract and failure path, plus an import smoke test and `npm pack`/install check. Add a build step only if the distribution target requires compilation; otherwise document that source ESM is the distribution.
6. Reassess whether `chunk`, `retry`, `slugify`, and customer lookup belong in this package at all. Their unrelated responsibilities increase API and maintenance surface.

## Verification and remaining uncertainty

Verified on 2026-09-01: `npm test` passes both existing pricing tests; importing `src/util.js` succeeds and exposes seven utility functions; `npm pack --dry-run --json` fails with “Invalid package, must have name and version.” No build script is defined.

I did not infer compatibility requirements from consumers because none are present in this workspace. The intended API, runtime support range, and business rules for invalid orders, dates, money, customer data, and retry behavior remain to be confirmed before architecture is committed.
