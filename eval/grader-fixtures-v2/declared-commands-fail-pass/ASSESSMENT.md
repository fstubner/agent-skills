# Engineering assessment — discount engine

## Scope

**In scope:** the whole repository — `src/discount.js`, `test/discount.test.js`,
`package.json`, `README.md`.

**Depth:** targeted. It is four files.

## What I ran

Every command `package.json` declares, before writing anything below.

```
$ npm test
✔ below the threshold the base rate applies (2.3ms)
✖ at the threshold the higher rate applies (1.9ms)
✖ a five year member gets the loyalty uplift on top (0.7ms)
✖ loyalty is capped at five years (0.7ms)
ℹ pass 1  ℹ fail 3
```

```
$ npm run lint
'eslint' is not recognized as an internal or external command
```

```
$ npm run build
Error: Cannot find module '.../scripts/build.js'
```

**One of three declared commands runs, and it fails.** That is the headline
of this assessment and it took thirty seconds to establish.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Correctness | An order exactly at the threshold gets the lower rate | `src/discount.js:5` uses `subtotalMinor > THRESHOLD_MINOR`; the documented rule and `test/discount.test.js:10` both say at or above | Change to `>=`; the test already pins it |
| 2 | High | Reliability | The test suite is red — three of four tests fail | `npm test` output above; all three failures trace to finding 1 | Fix finding 1 and re-run; no test needs changing |
| 3 | Medium | Tooling | `npm run lint` cannot run: `eslint` is not a dependency and `.eslintrc.json` does not exist | `package.json` declares the script; neither the binary nor the config is in the repository | Add eslint and a config, or remove the script |
| 4 | Medium | Tooling | `npm run build` cannot run: `scripts/build.js` does not exist | `package.json:8` names it; there is no `scripts/` directory | Add the script or remove the declaration |
| 5 | High | Documentation | The README states all three commands are green on every commit; none of that is true | `README.md` against the three command outputs above | Correct the claim, and add CI so it cannot drift again |

**Findings 2 and 5 are the same failure seen twice.** There is no CI
configuration anywhere in the repository, so nothing has been checking the
claim the README makes. A red suite that nobody notices is how finding 1
survived: the test that catches it was written and is failing right now.

## Unconfirmed / requires investigation

- **Whether the threshold rule is `>` or `>=` in the business.** The README
  and the test agree on at-or-above, so I have rated finding 1 on that basis.
  If the code is right and both are wrong, finding 1 inverts into a
  documentation defect — but two independent statements say otherwise.

## Strengths

- **The tests pin the boundary, and they caught the bug.** `discount.test.js`
  asserts at exactly the threshold rather than only side of it, which is why
  finding 1 is visible at all rather than being a silent pricing error.
- **The calculation is pure and dependency-free.** `discountMinor` takes its
  inputs as arguments and returns a number, so it is trivially testable and
  the failures above point at one line.

## What I did not examine

- **Anything calling `discountMinor`.** No caller exists in this repository,
  so I cannot say how a wrong discount reaches a customer or whether
  something downstream compensates.
- **Whether lint or build ever worked.** There is no lock file, no CI history
  and no `scripts/` directory, so I cannot tell whether these commands are
  newly broken or were never real.
- **The hard-coded date.** `src/discount.js:7` builds a `Date` from a literal
  string rather than the current time, which makes loyalty years freeze. It
  may be a deliberate fixture for testing; I did not chase it and am
  recording it here rather than rating it.
