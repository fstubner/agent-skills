# Acceptance review — volunteer shifts

**Verdict: BLOCK.**

The product works. It is a different product from the one `PRODUCT.md`
describes, and I do not think that is mine to resolve — but it is certainly
not mine to ship.

## Two authored documents that disagree

`PRODUCT.md` says, under Success:

> A volunteer can see which shifts still need cover and sign up for one
> themselves, and the coordinator sees the gaps fill without chasing anyone.

`ux-walkthrough.md` says, under Primary job:

> The coordinator assigns a volunteer to a shift that needs cover.

Those are not two descriptions of one thing. One is self-serve and removes
the chasing; the other is the chasing, with a screen. The MVP scope in
`PRODUCT.md` is explicit about which it meant — "sign myself up for a shift,
cancel my own sign-up" — and the walkthrough has no such step.

Neither document is reconstructed. `PRODUCT.md` records a brief of 2 August
confirmed with the coordinator and two volunteers on 5 August;
`ux-walkthrough.md` records being written alongside the build on 19 August.
So this is not a provenance problem I can reason away. Two people wrote down
two different products, a fortnight apart, and the later one won without the
disagreement being noticed.

## The code implements the walkthrough

Every shift route requires the coordinator role:

- `src/server.js:25` — `GET /api/shifts`, `requireCoordinator`
- `src/server.js:29` — `POST /api/shifts/:id/assign`, `requireCoordinator`
- `src/server.js:34` — `POST /api/shifts/:id/unassign`, `requireCoordinator`

`src/server.js:22` gives anyone who does not ask for the coordinator role the
`volunteer` role, and `requireCoordinator` returns 403 for them. So a
volunteer cannot sign up for a shift, and cannot see which shifts need cover
either — both halves of the Success statement, not just the sign-up half:

```
$ grep -n requireCoordinator src/server.js
15:  const requireCoordinator = (req, res, next) => (
25:  app.get('/api/shifts', requireCoordinator, (req, res) => res.json({
29:  app.post('/api/shifts/:id/assign', requireCoordinator, (req, res) => {
34:  app.post('/api/shifts/:id/unassign', requireCoordinator, (req, res) => {
```

Three routes, three gates, and no fourth route for anyone else. I could not
start the server — `express` is not installed in this tree — so this is read
from the routing table rather than observed as a 403. The store beneath it
works and its two tests pass:

```
$ npm test
✔ shifts needing cover are listed soonest first
✔ a volunteer cannot be assigned to two shifts at the same time
ℹ pass 2  ℹ fail 0
```

`ARCHITECTURE.md` states the same decision in its own words — "Assignment is
a coordinator action. Volunteers do not write to the rota" — so the build is
internally coherent. It is coherent with the wrong document.

## Why I am not resolving this myself

The obvious move is to decide which document is right. I do not think an
acceptor should. Either answer is a product decision with real consequences:
self-serve is what the coordinator asked for and what would stop the ringing
round, and coordinator-assigns is what exists, works, and may have been
agreed for a reason nobody wrote down — volunteer reliability, safeguarding,
who is allowed on a shift with whom.

What I can say is that the divergence exists, that the code follows the
document written later and closer to the build, and that the one written from
the interview says something else. The `design-direction.md` interview is a
third data point on the contract's side: it records the volunteer's question
as "is there anything I could do on Saturday", which is a question this build
cannot answer for them.

This needs the coordinator, not a reviewer. It is a BLOCK rather than a
CONDITIONAL because the gap is the primary job, not a rough edge on it.

## What I did not check

- **The coordinator flow end to end.** I could not start the server at all —
  express is not installed here. I did not sign in as the coordinator, assign
  anyone, or drive the walkthrough's five steps, so the flow that *is* built
  is unverified by me beyond reading it and its two tests passing.
- **The clash rule.** `assign()` refuses a volunteer already on a shift at
  the same `startsAt`, which is a string comparison, so it catches exact
  duplicates and nothing about overlapping shifts of different lengths. There
  is no duration in the model. I have not tested it and am recording it as
  unexamined; it may be out of scope.
- **The phone layout.** The design direction commits to 18px type and 56px
  targets on a phone. `public/index.html` is a stub with no styling in this
  tree, so there is nothing for me to check that against.
- **Anything about reminders, volunteer records, or rotas beyond four weeks.**
  Declared out of MVP scope.

The finding came from reconciling the two documents against each other and
then against the routes. No automated gate contributed; I did not run one.
