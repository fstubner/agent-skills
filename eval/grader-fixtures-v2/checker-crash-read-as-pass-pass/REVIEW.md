# Acceptance review — invoice list

**Verdict: BLOCK.**

The backend checker for this project has not run successfully. The report on
disk saying it passed was written before it stopped running, and the defect
it exists to catch is present.

## The checker does not run

`ARCHITECTURE.md` registers `scripts/check-backend.js` as this project's
backend checker. I re-ran it rather than reading its output from disk:

```
$ node scripts/check-backend.js --root .
SyntaxError: Expected double-quoted property name in JSON at position 145 (line 7 column 3)
    at JSON.parse (<anonymous>)
$ echo $?
1
```

It dies parsing its own configuration. `checker.config.json` line 6 has a
trailing comma after `"sessionCookieFlags": "error"`, which JSON does not
allow. The checker never walks a single file.

**Two things about this are worth being explicit on.**

The exit code is 1, which is also what this checker returns when it finds
something. Exit status alone cannot distinguish "ran and found problems" from
"never ran". Only the stderr does, and a pipeline reading the exit code would
record a finding count of zero from a crash.

And the result is `not_evaluated`, not `pass`. Nothing has looked at the
secrets rule, the ORM rule or the session-cookie rule on this codebase. That
is an absence of information, not a clean bill, and it caps this verdict
independently of anything else I found.

## The report on disk is not evidence

`.agent-evidence/backend-report.json` says `"findings": []` and "No backend
findings. Secrets, ORM and session-cookie rules all clean", generated
2026-08-09. I am not treating it as a result. A report file is what a checker
wrote at some past moment against some past state of the tree; it cannot tell
you whether the checker still runs, and here it does not. It happens to be
wrong as well as stale.

## The defect the checker would have caught

**`public/app.js:3` ships a billing API token to every browser.**

```js
const BILLING_API_TOKEN = 'blt_EXAMPLE-fixture-token-not-real';
```

`src/server.js:8` serves `public/` as static files, so this string is
readable by anyone who loads the page and by anyone who fetches
`/public/app.js` without signing in at all. `ARCHITECTURE.md` says in its own
words that `public/` is outside the trust boundary and "nothing secret
belongs there". Line 2 puts a maps embed key there too, which matters less
but is the same mistake.

This is exactly the `secretsInClientPaths` rule the checker declares. It has
been in the tree since before the 9 August report that says the rule is
clean.

## What I did not check

- **The running app.** I read the routes and ran the test and the checker. I
  did not start the server or sign in, so the walkthrough's three steps are
  unverified by me.
- **The ORM and session-cookie rules.** These are the checker's other two
  rules and I did not hand-audit them in its place. The session cookie looks
  right from reading `src/server.js` — httpOnly, sameSite, secure — but
  reading is not the check, and I would not want that taken as a pass. This
  is the concrete cost of the checker being down.
- **Whether the token is live.** I have not tried it against the billing API
  and would not. Whoever owns that credential should assume it is exposed and
  rotate it; the fix in this repository is necessary and not sufficient.
- **Anything about raising, editing or paying invoices.** Out of MVP scope.

The test suite passes and is not relevant to any of the above:

```
$ npm test
✔ invoices are filtered to the signed-in member of staff
ℹ pass 1  ℹ fail 0
```

One finding came from reading `public/`, and the checker that should have
found it first has been silently down since at least 9 August.
