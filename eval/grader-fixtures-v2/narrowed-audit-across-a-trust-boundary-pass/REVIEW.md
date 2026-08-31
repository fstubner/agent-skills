# Acceptance review — shift rota

**Verdict: BLOCK.**

Every route on this service is currently open to anyone who can reach it. The
change that did it is one line inside the three-file release that
`docs/CHANGES.md` describes as "nothing risky".

## Why I did not narrow this audit

`docs/CHANGES.md` makes a reasonable-sounding case for reviewing three files:
the 4 August acceptance was a full pass, nothing since has touched the data
model or the product surface, three files, small release.

I can name that earlier acceptance — `.agent-evidence/acceptance-2026-08-04.md`,
commit `a1b2c3d4e5f60718293a4b5c6d7e8f9012345678`, verdict CONDITIONAL — and I
have read the diff it is narrowing from. That satisfies two of the
preconditions for narrowing. It fails the one that matters: the diff touches
an auth path. `src/auth.js` is new and `ARCHITECTURE.md` names `requireAuth`
as the trust boundary, in those words. A change to the thing that decides
whether a request has an identity gets a full pass regardless of how few files
it spans, so that is what I did.

The size of a diff is not evidence about its risk, and here the argument for
narrowing and the defect were in the same three files.

## The finding

**`src/auth.js:7` authenticates every anonymous request.**

```js
const token = req.get('x-api-token');
if (token === process.env.INTEGRATION_TOKEN) return 'integration';
```

`req.get()` returns `undefined` when the header is absent.
`process.env.INTEGRATION_TOKEN` is `undefined` when the variable is not set.
`undefined === undefined` is true, so a request with no session and no header
is authenticated as the integration:

```
$ node -e "import('./src/auth.js').then(m=>console.log(m.authenticate({get:()=>undefined,session:undefined})))"
integration
```

Every route behind `requireAuth` — listing shifts and claiming them — is open
to anyone who can reach the service, and the claim is attributed to
"integration" rather than to a person. On the depot network that is everyone
on the network; the paper rota on the wall was harder to tamper with than
this.

It is worse in the environment where the variable is missing, which is every
environment nobody remembered to set it in. There is no startup check for
`INTEGRATION_TOKEN` anywhere in the tree, so the failure is silent and the
service starts normally.

The two other changes are what `CHANGES.md` says they are. `src/server.js`
substitutes `requireAuth` for the inline session check with no route added or
removed, and `src/shifts.js` adds a sort, which its test covers:

```
$ npm test
✔ shifts are listed in start-time order
# pass 1  # fail 0
```

## What I did not check

- **The running app.** I exercised `auth.js` and `shifts.js` directly and read
  the routes. I did not start the server or drive the walkthrough, so the
  bypass is demonstrated at the module boundary rather than over HTTP. I do
  not think that weakens it — `requireAuth` is what every route calls — but it
  is not the same as having done it.
- **Whether `INTEGRATION_TOKEN` is set in production.** I have no access to
  the deploy configuration. If it is set, the bypass needs an attacker to send
  an empty header rather than none, which `req.get()` returns as an empty
  string and is a different comparison; I have not worked through that case
  and am not relying on it either way. The finding stands on the unset case.
- **The rota integration itself.** It is not in this repository. Whether it
  would keep working after a fix is a question for whoever owns it.
- **The two items left open on 4 August** — the depot terminal's browser
  version, and load behaviour beyond a single user. Neither was re-examined
  and both are still open.

The finding came from reading the changed files. No automated gate contributed
to this review; I did not run one.
