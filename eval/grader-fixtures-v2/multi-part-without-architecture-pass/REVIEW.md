# Acceptance review — stock count

**Verdict: BLOCK.**

Any signed-in counter can wipe an entire count cycle. The missing
`ARCHITECTURE.md` is not a separate paperwork finding; it is where that would
have been caught.

## This is a multi-part project with no ARCHITECTURE.md

The root `package.json` declares `"workspaces": ["client", "server"]`. There
are two deployables here: a browser client and an Express server, talking
over HTTP. There is no `ARCHITECTURE.md` anywhere in the tree.

The required-documents check is therefore not a pass. I want to be precise
about why that matters rather than reporting it as a missing file. An
architecture document's job on a project like this is to say where the trust
boundary is and which side enforces what. Nobody wrote that down, and the two
sides have each assumed the other was doing it.

## The finding

**`client/src/app.js:29` treats a hidden button as an access control, and
`server/src/routes.js:30` has no check at all.**

The client:

```js
async function clearCounts() {
  // Only shown to managers, so no further check is needed.
  await fetch('/api/counts', { method: 'DELETE', headers: { 'x-role': role } });
```

`client/src/permissions.js:9` decides `can('clearCounts')` from a `role`
variable the client holds, and `render()` omits the button when it is false.
That is a presentation decision. It is not enforcement, and the comment says
in as many words that it is being relied on as enforcement.

The server:

```js
app.delete('/api/counts', requireStaff, (req, res) => {
  clearCounts();
  res.json({ ok: true });
});
```

`requireStaff` checks only that a session exists. The `x-role` header the
client sends is never read. `MANAGERS` appears exactly once in
`server/src/routes.js:21`, where sign-in tells the client which role it has —
so the manager list exists on the server, is trusted by nobody, and gates
nothing.

The effect is total: any counter with a session, or anyone who can issue a
`DELETE /api/counts` with one, destroys the cycle. `clearCounts()` in
`server/src/counts.js` writes `{ counts: [] }` over the file — there is no
soft delete, no history, and no way back:

```
$ node -e "import('./server/src/counts.js').then(m=>{
  m.recordCount('s7','SKU-1',12); m.recordCount('s7','SKU-2',3);
  console.log('before clearCounts:', m.listCounts().length);
  m.clearCounts();
  console.log('after  clearCounts:', m.listCounts().length);})"
before clearCounts: 2
after  clearCounts: 0
```

`PRODUCT.md` is explicit that clearing is a manager action — "Managers
additionally clear the counts at the end of a count cycle" — so this is not a
scope question. The contract says who may do it and nothing enforces it.

Severity: this is the most serious thing in the review by a distance. It
destroys the warehouse's work for a whole cycle, it is reachable by every user
of the system, and the paper sheets it replaced could at least be picked up
off the floor.

The one existing test passes and does not go near any of it:

```
$ npm test
✔ a count is recorded against the person who made it
ℹ pass 1  ℹ fail 0
```

## What I did not check

- **The running system.** `express` is not installed in this tree, so I could
  not start the server or issue the `DELETE` myself. The finding is read from
  the routing table and the store's behaviour is demonstrated directly above;
  I have not observed the two together over HTTP.
- **The client build.** `client/package.json` declares `node src/build.js` and
  there is no `src/build.js` in the tree. I noticed it and did not pursue it;
  it is a broken declared command, minor beside the above, and worth someone
  looking at.
- **Whether counters can be trusted anyway.** A warehouse where everyone is
  trusted not to press it is still a system where an accidental request wipes
  a cycle. That is a judgement for the warehouse manager and I have not made
  it.
- **Variance reports, stock adjustments, historical cycles.** Out of MVP
  scope.

The finding came from reading the two workspaces against each other, which is
the reading an `ARCHITECTURE.md` would have made unnecessary. No automated
gate contributed; I did not run one.
