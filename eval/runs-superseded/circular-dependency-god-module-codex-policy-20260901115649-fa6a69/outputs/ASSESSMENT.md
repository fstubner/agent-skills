# Reuse assessment: `orders-core`

## Recommendation

Do not split this package out unchanged. It is small enough to extract, but it
needs a deliberate public API and validation pass first. The best split is an
additive one: keep the current source modules working, introduce an explicit
package entry point, and expose only the stable pricing/customer capabilities
needed by consumers. Treat the miscellaneous helpers as separate internal or
utility APIs rather than automatically making all of them public.

## What is here

- `src/pricing.js`: calculates a fixed per-item price in minor currency units
  and adds a weekend surcharge.
- `src/customers.js`: looks up two in-memory customers and creates a slug.
- `src/util.js`: formatting, order description, date parsing/weekend detection,
  chunking, retry, and imports from both pricing and customers.
- `test/pricing.test.js`: two happy-path pricing tests only.

The declared package entry point is `src/util.js`, so importing the package
currently exposes seven unrelated functions. There is no `exports` map, build
script, type declaration, runtime/version policy, dependency declaration, or
consumer-facing API documentation.

## Boundary and architecture findings

### High priority

1. **The entry point is an accidental aggregate.** `main` points at `util.js`,
   which makes implementation helpers (`chunk`, `retry`, `parseDate`, etc.) part
   of the effective public API. A split package should define a narrow,
   intentional entry point and use an `exports` map to prevent accidental
   deep imports.

2. **There is a circular dependency.** `pricing.js` imports `isWeekend` from
   `util.js`, while `util.js` imports `priceFor` from `pricing.js`; customers
   has the analogous dependency through `slugify`. ESM currently evaluates
   this successfully because the functions are called after module loading,
   but it makes initialization order fragile and complicates reuse. Move
   date/weekend and slug helpers into dependency-free modules, or invert the
   dependencies before extraction.

3. **Trust-boundary validation is absent.** `priceFor` accepts missing,
   negative, fractional, non-numeric, or otherwise invalid quantities. Dates
   are parsed structurally but are not validated for format or calendar
   correctness. A reusable package should reject invalid input with documented
   errors before doing calculations.

### Medium priority

4. **Business policy is implicit.** Currency, base price, surcharge, and
   weekend definition are hard-coded. The extracted API should document the
   currency/unit and either make policy configuration explicit or clearly state
   that these values are intentionally fixed.

5. **Customer storage is process-local and silent on misses.** Unknown IDs
   become a synthetic `Unknown` customer, which can hide authorization/data
   errors. Decide whether lookup should return `null`/a result type or whether
   fallback behavior is a compatibility requirement. If data becomes external,
   authorization and failure behavior need to be specified at that boundary.

6. **Utility contracts are underspecified.** `formatMoney` behaves incorrectly
   for negative minor values; `chunk` can loop forever when `size` is zero or
   negative; and `retry` does not define valid attempt counts, delay/backoff,
   error filtering, or async support. These functions should either be
   validated and tested or excluded from the reusable package surface.

## Compatibility and data considerations

There is no persistent schema or migration in this package. The in-memory
customer list is not a reusable data source and should not be treated as one.
If customer data moves to a service or database, use additive fields and
backwards-compatible reads during a rolling deployment; do not couple that
migration to the initial code split.

## Testing and release readiness

The current tests cover only weekday/weekend pricing for valid-looking input.
Before extraction, add focused tests for:

- invalid/missing order fields, quantity boundaries, and date validation;
- exact currency formatting, including zero and negative-value policy;
- customer hits, misses, and slug edge cases;
- `chunk` sizes and empty input;
- retry exhaustion, attempt counts, and thrown error preservation;
- the intended package entry point and supported import paths.

There is no build step. The only product-like verification available is direct
module import/execution, and the only configured test command runs the pricing
file. Add a package-level test command and, if distribution requires it, a
build/packaging check before claiming the split is releasable.

## Suggested extraction sequence

1. Agree on the supported public functions, input/output contracts, currency,
   and unknown-customer behavior.
2. Break the circular imports with dependency-free modules.
3. Add validation and focused failure-path tests while preserving current
   valid-call behavior.
4. Add an explicit entry point, `exports`, package metadata, and README usage
   examples; keep compatibility re-exports only if existing consumers require
   them.
5. Run the full tests, direct package import, and packaging/build checks in CI.

## Verification performed

- `npm test`: passed, 2 tests.
- Direct import of `src/util.js`: passed; all seven current exports were
  enumerated and `describeOrder` produced `Ada Fielding: 55.00` for a valid
  weekend order.
- Runtime probes showed missing order fields throw a `TypeError`, invalid
  dates are accepted, negative/fractional quantities are accepted, and
  negative money formats as `-1.-1`. A zero chunk size does not terminate and
  was stopped during probing.
- Repository-level Git status was unavailable because `/workspace` is not a
  Git worktree. No source or test files were modified.

Remaining uncertainty: consumer expectations, supported Node versions, and
whether the fallback customer behavior is relied upon are not represented in
the repository and must be clarified before finalizing the extracted API.
