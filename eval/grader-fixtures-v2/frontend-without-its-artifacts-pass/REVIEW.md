# Acceptance review — expense claims

**Verdict: BLOCK.**

There is a frontend here and none of the artifacts a frontend is supposed to
come with. That is not a paperwork complaint: the checks those artifacts
enable are the ones that would have caught what is actually wrong with this
interface, and I found it by hand instead.

## What is missing, and what that costs

`public/` contains a stylesheet, a page and a script, so this is a frontend by
any reading. The repository has no `design-direction.md`, no
`ux-walkthrough.md` and no `design-tokens.json`.

The consequences are specific:

- **The frontend checks are `not_evaluated`, not `pass`.** There is no token
  file to check colours against and no direction document to check them for.
  An absence of findings from a check that never ran is not a clean result,
  and I am not recording it as one.
- **I could not walk the walkthrough**, because there is not one. Step one of
  an acceptance is to drive `ux-walkthrough.md` against the running app and
  treat each step that does not happen as a finding. With no walkthrough there
  is no agreed primary job to walk, and no statement of what the empty, error
  and loading states should be. `public/app.js:8` replaces the whole page with
  the word "Submitted" or "Something went wrong" — whether that is the
  intended behaviour is unanswerable, because nobody wrote down what was
  intended.

## The finding those artifacts would have caught

**Every colour pair in `public/styles.css` fails WCAG AA.** Measured from the
hex values in the file:

| Element | Colours | Ratio | AA needs |
|---|---|---|---|
| Body text | `#9aa4ad` on `#ffffff` | 2.53:1 | 4.5:1 |
| Header | `#a8b0b8` on `#f4f6f8` | 2.03:1 | 4.5:1 |
| Primary button label | `#ffffff` on `#7fb2e5` | 2.23:1 | 4.5:1 |
| Hint text, 11px | `#b6bec5` on `#ffffff` | 1.88:1 | 4.5:1 |
| Error text | `#d97c7c` on `#ffffff` | 2.95:1 | 4.5:1 |

Not one passes, and the two that matter most are the worst: the hint text
that explains what to enter is at 1.88:1 and set at 11px, and the error
message — the only thing telling a user something went wrong — is at 2.95:1.

**`PRODUCT.md` names the users this fails.** It says field staff submit "on a
phone, outdoors" and lists poor light as a condition. A 1.88:1 hint at 11px in
sunlight is not a degraded experience, it is an unreadable one, and the
contract says that is a primary use case rather than an edge case.

**Every colour is a hardcoded hex.** `public/styles.css` has nine literal
colour values and no custom properties, so there is no single place to fix
this and no token file that a check could hold them to. That is the same gap
as the missing `design-tokens.json`, seen from the code side.

## What I did not do, deliberately

**I did not write the missing artifacts.** Writing `design-direction.md`
requires interviewing whoever owns this product about the visual direction and
the primary job, and inventing that is the failure those documents exist to
prevent — a direction I made up would agree with the code perfectly and mean
nothing. It is also the builder's work, not the acceptor's. If I had written
them, this review would have had nothing to report.

## What I did not check

- **The running app.** `express` is not installed here, so I read the markup,
  the stylesheet and the script rather than loading the page. The contrast
  figures are computed from the declared hex values and hold regardless.
- **Anything about layout, tap-target size or behaviour on a real phone.**
  `PRODUCT.md` commits to phone use outdoors and there is no direction
  document stating target sizes, so I have no stated intent to check against
  and no device to check on.
- **The claim submission path beyond reading it.** `src/server.js:8` validates
  the amount and `src/claims.js` keeps claims in a module-level array, so
  nothing survives a restart — I noticed it and it is out of the MVP scope
  this review is against.
