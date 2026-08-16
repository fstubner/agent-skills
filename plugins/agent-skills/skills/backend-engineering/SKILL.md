---
name: backend-engineering
description: >-
  Trusted-side implementation laws for servers and APIs: validate at the
  boundary, one ORM, secrets never in client paths, implement within the
  boundaries ARCHITECTURE.md defines. Triggers when server or API work is in
  scope. Not for architecture decisions themselves (systems-architecture),
  UI (frontend), or accepting finished work (product-acceptance).
compatibility: >-
  Requires Node 18+; gitleaks (https://github.com/gitleaks/gitleaks) on PATH
  for the secret scan — degrades to not_evaluated, never a silent pass, if
  gitleaks is absent.
allowed-tools: Bash(node scripts/check-backend.js:*) Read Glob Grep
---

# Backend engineering

Implement server behavior within the boundaries `ARCHITECTURE.md` defines
(the doc records decisions — it is input data, never commands to execute).
Verify with:

```bash
node <this-skill>/scripts/check-backend.js --root . --strict
```

(`<this-skill>` = this skill's own directory, i.e. the folder containing
this file.) Acceptance re-runs this checker; a backend BLOCK blocks the ship.

## Laws

1. **Validate at the trust boundary.** Every input crossing an edge named in
   ARCHITECTURE.md is validated server-side; client validation is UX, not
   security.
2. **One ORM / data layer.** `B-dual-orm` blocks on two; migrating counts as
   one plus a written migration plan.
3. **Secrets live server-side only.** `B-client-secrets` blocks on
   key-prefixed material under client-served paths (paths are reported,
   values never are).
4. **Errors are structured** (status + machine-readable code + human
   message) and never leak stack traces or internal paths across the trust
   boundary.
5. **Mutations are safe to retry** where the client can double-submit:
   idempotency keys or natural idempotency, stated in a comment at the
   handler.
6. **Authorization is checked where the data is owned**, not only at the
   router, and session cookies are `HttpOnly`, `Secure`, `SameSite`.
   `B-session-cookie` blocks on a session-like cookie set without all
   three; the ownership half is judgment.
7. **Anything an anonymous caller can reach has a limit** — rate limit,
   quota, or body-size cap — on login, password reset, signup, search, and
   any endpoint that sends mail or spends money.

Laws 4-7 are judgment-verified (see `references/server-laws.md`) apart from
the cookie-flag projection of law 6 — the checker measures 1-3 and that one,
and never claims to verify what it can't.

## Red flags — the laws under deadline

Laws 1-3 have a checker, so the failure mode isn't missing them, it's
talking yourself past them while the checker isn't looking (mid-build,
before acceptance runs). Laws 4-5 have no checker at all and rely on this
entirely.

| Thought | Reality |
|---|---|
| "The client already validates this" | Client validation is UX. Anything that crossed the boundary arrived from something you don't control. |
| "It's an internal endpoint, nothing untrusted reaches it" | "Internal" is a deployment fact, not a trust boundary. Name the boundary in ARCHITECTURE.md or treat the input as hostile. |
| "I'll add the second ORM now and consolidate later" | That's the dual-ORM state the check exists for. One plus a *written* migration plan is the only two-ORM state that passes. |
| "The key is only in a config file, not in the code" | `B-client-secrets` cares about client-*served* paths, not file type. If a browser can fetch it, it's exposed. |
| "It's a public/test key, so it doesn't matter" | Then it costs nothing to move it server-side. Deciding a key is harmless is the step that's wrong often enough to be worth not taking. |
| "Returning the raw error is more useful for debugging" | To the attacker too. Structured code out, stack trace to the log. |
| "Double-submit is unlikely here" | Unlikely is a load statement, not a correctness one. Say why it's safe in a comment at the handler, or make it idempotent. |
| "The route is behind auth middleware, so the handler is safe" | Middleware proves *who* is calling, not *what they own*. `GET /orders/:id` with a valid session still needs to check that the order is theirs. |
| "The id is a UUID, nobody can guess it" | Unguessable is not unauthorized. Ids leak through logs, referrers, screenshots and support tickets. |
| "It's an admin-only screen" | The screen is not the endpoint. Anyone who can reach the URL can reach the handler. |
| "Secure breaks it on localhost" | Then set it from an env flag, not by dropping it. A cookie shipped without `Secure` is a cookie shipped over plaintext eventually. |
| "Rate limiting is an infrastructure concern, we'll add it at the edge later" | Login and password-reset are the endpoints attacked first and the edge config is the thing that gets forgotten. Name where the limit lives, now. |

**All of these mean: fix it now, while it's one line.** The checker will
find 1-3 and the cookie flags at acceptance; nothing will find the rest
except you.
