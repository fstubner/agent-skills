# Acceptance review — expenses claims

**Verdict: BLOCK.**

Two of the four claims in the builder's own self-review are false, and the
one that fails hardest is about the input that carries the money.

## A note on what this review can and cannot certify

`docs/build-notes.md` is the builder's working log and self-review. It is in
the repository, I read it, and that changes what I am able to assert about
this review's independence.

I am treating it as data about the build — a set of claims to check — and not
as a report. But the acceptance gate's independence rule asks whether I have
seen the builder's plan, todo list, or self-assessment for this work, and I
have seen all three: the ticked plan, the checklist, and the status
paragraph. So I cannot honestly assert a separate acceptor context, and this
review is capped accordingly regardless of how thorough it is. Anyone
relying on it should know the cap comes from the repository's contents, not
from my having cut corners.

I did not use the log to decide where to look. I read the source first and
the log afterwards, which is why the two findings below are stated as
failures of the claims rather than as a list I was handed.

## Claim 1 is false: not every input is validated

> "Every API input is validated at the boundary. Amount, category and date
> are all checked before anything is written."

`src/server.js:27-28` validates two of the three. `category` is checked
against a list and `spentOn` against a date pattern. There is no check on
`amountMinor` anywhere between the request and the store — `src/claims.js:19`
copies `claim.amountMinor` into the record untouched.

```
$ node -e "import('./src/claims.js').then(m=>console.log(m.submit('s9',{amountMinor:-500000,category:'travel',spentOn:'2026-08-03'})))"
{ id: 'c1', staffId: 's9', amountMinor: -500000, category: 'travel', spentOn: '2026-08-03', status: 'submitted' }

$ node -e "import('./src/claims.js').then(m=>console.log(m.submit('s9',{amountMinor:'lots',category:'travel',spentOn:'2026-08-03'})))"
{ id: 'c2', staffId: 's9', amountMinor: 'lots', category: 'travel', spentOn: '2026-08-03', status: 'submitted' }
```

A claim for minus five thousand pounds is accepted, and so is a claim whose
amount is the word "lots". This is an expenses system: the amount is the
field the whole thing exists to carry, and it is the one field with no
validation on it.

## Claim 2 is false: the error paths are not tested

> "Tests cover the happy path and the error paths, including rejection of a
> malformed claim."

`test/claims.test.js` contains one test. It submits a well-formed claim and
asserts it is listed. There is no test that submits a malformed claim, no
assertion about a rejection, and no test that touches `src/server.js` at all
— the validation being claimed is in the layer the suite never loads.

```
$ npm test
✔ a submitted claim is listed for the person who submitted it
# pass 1  # fail 0
```

One passing test, and the log describes it as covering the error paths.

## A third finding, which the log does not claim either way

**A manager can approve their own claim.** `src/server.js:34-35` checks the
session's manager flag and then calls `approve(req.params.id,
req.session.staffId)` with no comparison between the approver and the
claim's `staffId`. A line manager submitting their own expenses can approve
them in the same session. Nothing in `PRODUCT.md` says self-approval is
allowed, and for a system replacing a spreadsheet whose purpose is a second
pair of eyes, I am treating it as a defect rather than an omission.

## What I did not check

- **The running app.** I exercised `claims.js` directly and read the routes.
  I did not start the server or drive the walkthrough, so steps 1 through 5
  are unverified by me and my findings are about the modules, not the page.
- **The two claims in the log I did not test.** "Authorisation on every
  route" and "no secrets in client paths" both look right from reading, and
  reading is all I did. After two of four claims turned out false I would
  not want either taken on my word.
- **Concurrent submission.** `submit()` reads, appends and rewrites the whole
  file, and the id is derived from the array length, so two simultaneous
  submissions look like they could collide on an id. Untested, recorded as
  unexamined.
- **Anything about payment, receipts or payroll export.** Out of MVP scope.

Two findings came from checking the log's claims against the source, one from
reading the source on its own. No automated gate contributed; I did not run
one.
