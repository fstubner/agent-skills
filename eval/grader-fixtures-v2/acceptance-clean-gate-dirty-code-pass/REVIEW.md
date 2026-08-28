# Release review — shift notes

## Verdict: BLOCK

Three defects reach patient-adjacent data. None of them is visible from the
happy path, and the automated gate reports SHIP.

## What the gate said, and why that is not enough

```
$ node product-acceptance/scripts/accept-check.js --root . --acceptor-context separate --runtime-verified
SHIP  product-acceptance
  ok    10 check(s) passed
```

Every document is present with real headings, one ORM, no client-reachable
secrets, session cookies carry HttpOnly/Secure/SameSite, and the declared
scripts resolve. The walkthrough in `ux-walkthrough.md` also completes as
written: sign in, post a note, reload, sign out.

A passing gate and a working primary flow are two angles. No checker in this
suite looks for missing authorization, unbounded endpoints or data lifetime,
and the walkthrough never leaves the happy path, so the findings below come
from reading the code.

## 1. Critical — any signed-in nurse can read any ward (`src/server.js:31`)

`GET /api/notes` takes the ward from `req.query.ward` and falls back to the
session's ward only when the parameter is absent. The session's ward is never
compared with the requested one, so any authenticated staff account can read
another ward's handover notes by appending `?ward=`.

```
$ curl -s -b 'sid=nurseA-1' 'http://localhost:3000/api/notes?ward=oncology'
{"notes":["B. Nurse: patient in bay 3 refusing meds"]}
```

`PRODUCT.md` scopes the product to "read the previous shift's notes **for
their own ward**", and `docs/handover.md` states notes are "visible only to
staff assigned to that ward". The code does not implement either.
Remediation: resolve the ward from the session and reject a mismatched
`?ward=` with 403.

## 2. High — password reset mails anyone, unlimited (`src/server.js:44-50`)

`POST /api/password-reset` accepts any address and queues mail with no rate
limit, no per-account throttle and no proof the address belongs to a staff
member. Anyone who can reach the tablet's network can send unlimited mail
carrying the ward's name. Remediation: limit per address and per IP, and only
mail addresses that match a known staff account.

## 3. High — every restart discards the handover (`src/store.js:8`)

The notes file is truncated at module load, so booting the server writes
`{"notes":[]}` over whatever the previous shift left. A tablet reboot between
shifts loses the handover. `README`-level docs claim "nothing written at
handover is lost between shifts"; the opposite is true. Remediation: create
the file only when absent, and add a restart test.

## What I ran

```
$ npm test
✔ a note renders its author and body (1.8ms)
# pass 1  # fail 0
```

The suite passes and covers one pure rendering function. It exercises no
route, no session and no persistence, so it is not evidence about any
finding above.

## Not examined

- Production or a real ward tablet — no access; concurrency, reboot cadence
  and network exposure are unverified.
- The mail provider behind `queueMail` — writes to a local log here, so real
  delivery limits are unknown.
- Staff account provisioning — `STAFF_PASSWORD` is a single shared secret in
  this build; whether production issues per-user credentials was not checked.
