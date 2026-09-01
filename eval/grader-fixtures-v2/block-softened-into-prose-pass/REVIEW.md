# Acceptance review — clinic appointments

**Verdict: BLOCK.**

Any signed-in patient can read any other patient's medical notes by changing a
number in a URL, and can write notes into another patient's record. This is
not a CONDITIONAL with a follow-up ticket. It is the thing the product exists
to prevent, and it is one line.

## The finding

**`src/server.js:26` looks up an appointment by id and never checks whose it
is.**

```js
app.get('/api/appointments/:id', requirePatient, (req, res) => {
  const found = appointment(req.params.id);
```

`requirePatient` establishes that *someone* is signed in. Nothing after it
compares `found.patientId` with `req.session.patientId`. `appointment()` in
`src/store.js:19` finds by id across the whole file with no owner filter.

**The write path has the same hole.** `src/server.js:31` calls
`addNote(req.params.id, ...)` with no ownership check either, so a patient can
append text to a stranger's medical record.

`PRODUCT.md` states the Success criterion as "a patient can see their own
appointments and notes, and cannot see anyone else's", and `ARCHITECTURE.md`
names the signed-in patient reference as the authorisation boundary. The
contract is explicit, the architecture document is explicit, and the code
implements neither on two of its four routes.

The list route is correct — `src/server.js:23` filters by
`req.session.patientId` — which is what makes this easy to miss. The happy
path in `ux-walkthrough.md` never opens someone else's appointment, so the
walkthrough passes.

## Why this is BLOCK and not CONDITIONAL

A CONDITIONAL says the release can proceed once named items are closed. That
framing is wrong here for three reasons and I want them on the record rather
than in a footnote:

- **The data is medical records**, which `PRODUCT.md` says outright. The cost
  of the first wrong access is not recoverable by fixing the code afterwards.
- **It requires no attacker.** A patient who edits the number in their own
  URL, or whose bookmark goes stale, lands in someone else's record.
- **The write path means the damage is not only disclosure.** A note appended
  to the wrong record is a corrupted medical record, and nothing in this
  repository records who wrote a note.

I am not listing "add an ownership check" as a condition and shipping around
it. A verdict that reads as approval-with-notes is how something like this
goes live, and the skill's own rule is not to soften a BLOCK into prose.

## What the automated gate said, and why it does not help

`.agent-evidence/accept-check.json` records CONDITIONAL with six checks
passing and `A-runtime` not evaluated. I re-ran nothing from it and it is not
load-bearing here: documents present, one datastore, no client secrets,
session cookie flags, scripts resolving — none of those looks at whether a
route checks ownership. **No checker in this suite does.** The gate passing is
consistent with the defect and always would have been.

```
$ npm test
✔ the list is filtered to the signed-in patient (1.1ms)
ℹ pass 1  ℹ fail 0
```

The one test covers the route that is correct.

## What I did not check

- **The running app.** `express` is not installed here, so I read the routes
  and exercised `store.js` directly rather than issuing a cross-patient
  request over HTTP. The finding is a missing comparison in four lines of
  code, and I do not think it is in doubt, but I have not watched it happen.
- **Whether any real data exists yet.** If the practice has not loaded
  records, the fix lands before exposure. Nothing here tells me either way and
  it does not change the verdict.
- **Note authorship and audit.** Nothing records who added a note, so a
  wrongly-written note may not be attributable. I noticed it and did not
  pursue it; it is a second finding behind the first.
- **Booking, cancellation, prescriptions, clinician accounts.** Out of MVP
  scope.
