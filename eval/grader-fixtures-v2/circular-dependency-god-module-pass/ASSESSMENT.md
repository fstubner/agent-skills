# Engineering assessment — orders core

## Scope

**In scope:** `src/util.js`, `src/pricing.js`, `src/customers.js`,
`test/pricing.test.js`, `package.json`, `README.md`. Every file.

**Depth:** targeted.

## What I ran

```
$ npm test
✔ a weekday order has no surcharge (1.3ms)
✔ a weekend order carries the surcharge (0.2ms)
ℹ pass 2  ℹ fail 0
```

```
$ node <agent-skills>/code-organization/scripts/check-organization.js --root .
{ "verdict": "BLOCK", "checks": [ { "id": "O-circular-deps", "status": "fail" } ] }
```

The organization checker is the relevant one for this repository and it
fails. I am citing its report rather than re-deriving what it measures.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Architecture | Two import cycles through the shared helper module | `check-organization.js` reports `O-circular-deps` fail, verdict BLOCK. `src/util.js:2` imports `./pricing.js`, which imports `./util.js` at line 1; `src/util.js:3` imports `./customers.js`, which imports `./util.js` at line 1 | Move `describeOrder` out of `util.js` into an order module. A helper module must not import the domain modules that import it |
| 2 | Medium | Architecture | `src/util.js` is a grab-bag: money formatting, order description, slugs, date parsing, chunking and retry in one file | `src/util.js` exports seven functions with no shared subject; its own comment says it holds "everything that did not obviously belong elsewhere" | Split by subject — money, dates, collections — and let `describeOrder` live with orders. Finding 1 disappears as a side effect |
| 3 | Low | Maintainability | The test suite covers pricing only | `test/pricing.test.js` is the only test; nothing exercises `customers.js` or the six other helpers | Add coverage as the split in finding 2 happens, rather than before it |

**Finding 1 is a symptom of finding 2.** `describeOrder` is an order-level
function that ended up in the helper module, and it is the only reason
`util.js` imports anything at all. Moving that one function removes both
cycles; the rest of the split is cohesion work that can follow at its own
pace.

## Unconfirmed / requires investigation

- **Whether the cycles cause a real initialisation problem today.** ES module
  cycles resolve without error in many shapes and break in others depending
  on what is read at module-evaluation time. Nothing here reads an import at
  the top level, so I suspect it currently works by luck. I have not
  constructed the failing case, and "works today" is not a reason to keep it.

## Strengths

- **The pricing tests pin both branches**, weekday and weekend, so the one
  piece of real business logic here is covered at its boundary.
- **`findCustomer` returns a fallback rather than undefined**, so callers do
  not have to guard against a missing customer.

## What I did not examine

- **Anything importing this package.** `package.json` names `src/util.js` as
  the entry point, so the grab-bag is the public surface, and I cannot see
  what consumers rely on. That constrains how finding 2 can be done without a
  breaking change.
- **The README's claim that nothing can be removed.** It is probably true and
  it is beside the point: the finding is that unrelated things share a file,
  not that any of them is dead.
- **Runtime behaviour beyond the two tests.**
