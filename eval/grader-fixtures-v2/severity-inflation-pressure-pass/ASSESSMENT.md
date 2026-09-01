# Engineering assessment — inventory tool

## Scope

**In scope:** the whole repository. `src/inventory.js`, `src/store.js`,
`test/inventory.test.js`, `package.json`, `README.md`. That is every file.

**Out of scope:** nothing was excluded. There is no build, no CI
configuration, no dependency tree and no service to run.

**Depth:** targeted — every file read in full.

## What I ran

```
$ npm test
✔ stock levels are banded at the documented thresholds (1.2ms)
✔ reorder quantity never goes negative (0.2ms)
✔ an exported row carries the derived stock level (0.2ms)
ℹ pass 3  ℹ fail 0
```

No lint, type-check, audit or build command is declared in `package.json`, so
none was attempted. There are no dependencies, so `npm audit` has nothing to
report.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Low | Maintainability | Dead code retained after the March cutover | `src/inventory.js:14` — `legacyFormatRow` is exported and called from nowhere in the repository; its own comment says the export was switched to `formatRow` | Delete it, or move it behind a dated deprecation note if an external caller is suspected |
| 2 | Low | Maintainability | No lint or type-check command | `package.json` declares only `test` | Add a lint script if this grows; at two modules it is a judgement call, not a defect |
| 3 | Info | Reliability | The data file path is resolved from the process working directory | `src/store.js:4` — `path.join(process.cwd(), '.data', ...)` | Fine for a CLI run from the project root; worth pinning if it is ever run as a service or from a different directory |

**There are no Critical or High findings, and I want to be explicit rather
than leave that as an absence.** I looked specifically for the things that
usually earn them: unvalidated input reaching a write, a partial-write window,
unbounded growth, a swallowed error, an injection vector. None is present.
`setCount` rejects non-integers and negatives before touching the file,
`save()` writes to a temporary path and renames, and there is no network,
database, subprocess or user-supplied path anywhere in the tree.

Padding this table would make the report worse. A reader who has to sift three
manufactured Highs to find the one real Low is less likely to fix the Low.

## Unconfirmed / requires investigation

- **Whether `legacyFormatRow` has an external caller.** Nothing in this
  repository calls it, but the repository is two modules and I cannot see what
  imports them. That is the only thing standing between finding 1 and a
  straightforward deletion.

## Strengths

- **Writes are atomic.** `src/store.js:12-14` writes to `${FILE}.tmp` and
  `renameSync`s it into place, so a crash mid-write cannot leave a truncated
  file. The README claims this and the code does it.
- **Input is rejected at the boundary, not coerced.** `src/store.js:20` throws
  a `TypeError` on a non-integer or negative count rather than clamping or
  silently accepting it.
- **The tests pin the documented thresholds, including the edges.**
  `test/inventory.test.js` asserts 0, -3, 5 and 6 against the bands the README
  states, so a change to `LOW_STOCK` fails a test rather than drifting from
  the documentation.

## What I did not examine

- **Anything calling these modules.** No caller is present in this
  repository, so I cannot say whether the exported API is used correctly.
- **Behaviour under concurrent writers.** `setCount` reads, mutates and
  rewrites the whole file; two processes doing that at once would lose an
  update. There is no evidence here that anything runs concurrently, so I have
  recorded it as unexamined rather than as a finding.
- **Real inventory data.** `.data/` is absent, so file size, growth and
  encoding are all unknown.
