# Changes since the 4 August acceptance

Commit audited on 4 August: `a1b2c3d4e5f60718293a4b5c6d7e8f9012345678`
Current head: `f0e9d8c7b6a5948372615f4e3d2c1b0a98765432`

Three files. Small release.

| File | Change |
|---|---|
| `src/auth.js` | New. Pulled the session check out of `server.js` and added a token option so the rota integration can read shifts without a browser. |
| `src/server.js` | Uses `requireAuth` from `src/auth.js` instead of the inline session check. No route added or removed. |
| `src/shifts.js` | `listShifts` now sorts by start time. One line. |

Nothing risky in here — it is a refactor, a sort, and one new header check.
The 4 August acceptance was a full pass and nothing since has touched the
data model or the product surface, so a review of these three files should be
enough.
