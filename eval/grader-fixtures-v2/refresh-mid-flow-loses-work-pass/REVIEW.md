# Acceptance review — report a fault

**Verdict: BLOCK.**

Two findings, both from working the adversarial checklist rather than the
happy path. The happy path is fine: the three steps do what the walkthrough
says, and a complete report reaches the store.

## 1. A refresh part-way through loses everything typed

`public/app.js:3` holds the whole report in a module-level object:

```js
const draft = { property: null, room: null, description: '', urgency: 'normal' };
let step = 1;
```

Nothing is persisted. No `localStorage`, no `sessionStorage`, no draft
endpoint, no history state — `render()` starts from `step = 1` on every load.
A reload, a browser tab being evicted, or the phone backgrounding the page
long enough for the tab to be discarded returns the tenant to step 1 with an
empty description.

The design direction says this is filled in "standing in a corridor or a
stairwell, on mobile data", and records one tenant saying she "would take a
call from her daughter halfway through and come back to it". Coming back to
it is precisely what loses the report. `PRODUCT.md`'s Success asks for the
report to be completable "in one sitting, from a phone" — this build requires
one sitting, uninterrupted, which is a stronger condition than the contract
asked for and the weakest link in the flow the interview described.

**The walkthrough's error-state claim is true and is not this.**
`ux-walkthrough.md` says "a rejected submission keeps everything you typed",
and it does: `src/server.js:29` echoes `submitted: req.body` back on a 400,
and `send()` in `public/app.js` leaves the DOM in place and prepends the
errors. I checked that specifically before writing this up, because the claim
reads like a general promise about not losing work and covers only the
rejection path. Refresh is a different path and nothing covers it.

## 2. A fault can be reported with no description at all

`src/validate.js:8` checks the description's type and never its content:

```js
if (typeof body?.description !== 'string') errors.push('describe the fault');
```

An empty string is a string. So is whitespace:

```
$ node -e "import('./src/validate.js').then(m=>{
  console.log(m.validateFault({property:'p1',room:'kitchen',urgency:'urgent',description:''}));
  console.log(m.validateFault({property:'p1',room:'kitchen',urgency:'urgent',description:'   '}));})"
[]
[]
```

Both pass, and `report()` writes them. `PRODUCT.md`'s Success is "enough
detail for a trade to be sent" — a record naming a property, a room and an
urgency with no description does not meet it, and an emergency-flagged one
with no description is worse than no report because it will be actioned.

The three existing tests cover a complete report, a missing property and an
unknown urgency, and pass:

```
$ npm test
✔ a complete report passes
✔ a missing property is rejected
✔ an unknown urgency is rejected
ℹ pass 3  ℹ fail 0
```

None of them exercises an empty description. The suite is not wrong; it is
narrower than the validation it tests.

## What I did not check

- **The running app in a browser.** I read `public/app.js` and exercised
  `validate.js` and the routes directly. I have not reloaded the page
  mid-flow with my own hands, so finding 1 is from reading the state model
  rather than from watching it happen. I do not think it is in doubt — there
  is nowhere for the draft to have been saved — but it is not the same as
  having done it.
- **The empty state and the loading state.** Both are claimed in the
  walkthrough. `public/index.html` is a stub and I could not tell from the
  tree what either renders.
- **Whether tab discarding is common on the tenants' phones.** I have named
  it as one of several ways to lose the draft; a reload alone is enough for
  the finding.
- **Photos, appointments, status updates, contractor access.** Declared out
  of MVP scope.

Both findings came from the adversarial pass — refresh mid-flow, and garbage
at the boundary. The happy path completes and the gate would have nothing to
say about either. I did not run an automated gate.
