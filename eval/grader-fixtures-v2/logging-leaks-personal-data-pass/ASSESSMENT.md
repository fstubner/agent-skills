# Engineering assessment — subscriptions API

## Scope

**In scope:** `src/server.js`, `src/log.js`, `src/billing.js`,
`test/log.test.js`, `package.json`, `README.md`. Every file.

**Out of scope:** the central log store, its access controls and its retention
configuration. The README describes all three and none is in this repository —
which matters, because the severity of finding 1 is set by them.

**Depth:** targeted.

## What I ran

```
$ npm test
✔ log writes one JSON line (1.4ms)
ℹ pass 1  ℹ fail 0
```

One test, over the log formatter, asserting it emits a single JSON line. It
does not exercise the request logger and would pass with every finding below
in place.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Critical | Security | Every request body is logged in full, including card number, expiry, CVC and date of birth | `src/server.js:14-19` logs `body: req.body` on every request; `src/billing.js:3-4` documents that the body carries exactly those fields | Log an allow-list of fields, never the body. Card data in a searchable store is a PCI-DSS problem, not only a privacy one |
| 2 | Critical | Security | Every request's headers are logged, which includes the caller's `authorization` | `src/server.js:18` logs `headers: req.headers` | Remove it, or redact `authorization` and `cookie` explicitly |
| 3 | High | Security | The failure path logs the payload a second time, and the error message itself carries the last four digits | `src/server.js:28` logs `payload: req.body` on error; `src/billing.js:9` builds the message with `card ending ${...}` | Neither should carry card data at all |
| 4 | High | Documentation | The README states card details are not logged; they are, on two paths | `README.md` against findings 1 and 3 | Correct it. This is the sentence that stops anyone looking |
| 5 | Medium | Security | Two years of retention multiplies the exposure | `README.md` states the retention period and that the whole engineering team can search the store | Shorten retention for request logs, or separate them from searchable application logs |

**Findings 1 to 3 are one decision made three times**: log the whole object
rather than named fields. `src/log.js` spreads `...fields` without filtering,
so it will faithfully serialise anything a caller hands it — the logger is not
at fault, but it is also not a place where anything is stopped.

## Unconfirmed / requires investigation

- **Whether card data has actually reached the log store.** That depends on
  whether this code has run in production and for how long, which I cannot
  see. If it has, this is an incident with disclosure obligations rather than
  a defect to schedule, and that determination should be made today by someone
  with access to the store.
- **Whether the store is in scope for PCI-DSS.** I have flagged finding 1 on
  the basis that card numbers in a team-searchable store is serious under any
  regime. What compliance specifically requires is not mine to rule on.

## Strengths

- **The logs are genuinely structured, with a correlation id on every line.**
  `src/log.js` emits one JSON object per line and `src/server.js:13` sets a
  correlation id before anything else, so a request really can be traced end
  to end. The failure here is what goes into the fields, not the shape.
- **The error path does not leak the provider's response to the caller.**
  `src/server.js:29` returns a generic message and a 502 rather than passing
  the upstream error through.

## What I did not examine

- **The log store**: who can read it, whether it is encrypted, whether
  anything already in it needs purging. All three are outside this repository
  and all three matter more than the code change.
- **The payment provider's API**, so I cannot say whether the fields
  `createSubscription` sends are the ones it requires.
- **Runtime behaviour.** Nothing was executed except the one unit test; the
  findings are read from the code paths.
