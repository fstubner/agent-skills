# oncall build — the first complex end-to-end eval

The biggest task this suite has been measured on: an on-call incident
tracker with sign-in and sessions, a list with filters, an incident
timeline, SQLite persistence, a migration that alters an existing table, a
CSV-import CLI with exit codes, and one authorization rule (only the
assignee or the opener may close). Three arms, sonnet, one run each,
identical task file.

| Arm | Exposure |
|---|---|
| B-control | nothing — the task alone |
| A-routing | `routing/routing.md` prepended to the prompt, exactly as the SessionStart hook injects it |
| C-forced | told to invoke `product-build` and follow its dispatch |

## Invocation

| Arm | agent-skills calls | Artifacts written |
|---|---|---|
| B-control | 0 | none |
| A-routing | **0** | **none** |
| C-forced | 7 | PRODUCT.md, ARCHITECTURE.md, design-direction.md, design-tokens.json, ux-walkthrough.md |

The routing arm's file listing is indistinguishable from the control's.
Routing text moved a subagent off its default on the earlier three-prompt
run; on a real build task it did not. That is the third mechanism to be
measured and the second to fail: description force (0/5), routing text
(worked at n=3 on toy prompts, 0/1 here).

## What the checkers said

| Checker | B-control | A-routing | C-forced |
|---|---|---|---|
| systems-architecture | BLOCK (no doc) | BLOCK (no doc) | SHIP |
| backend-engineering | BLOCK (no arch doc) | BLOCK (no arch doc) | SHIP |
| frontend | CONDITIONAL | CONDITIONAL | SHIP |
| code-organization | SHIP | SHIP | SHIP |
| data-modeling | SHIP | SHIP | SHIP |

Every discriminating failure is a **missing document**. Not one is a
property of the running code.

## What the code said

Measured directly, independent of any checker:

| Property | B-control | A-routing | C-forced |
|---|---|---|---|
| Ownership check on close | yes | yes | yes |
| Session cookie HttpOnly + SameSite | yes | yes | yes |
| Server-side input validation | yes | yes | yes |
| Parameterised SQL, no string concat | yes | yes | yes |
| Migration altering an existing table | yes | yes | yes |
| Automated tests | **no** | **no** | **no** |
| Lines of source | 913 | 1085 | 1261 |

On every substantive property, the three arms are identical. The control
shipped the session-cookie flags that `B-session-cookie` was written for
the same day, and the authorization-at-the-owner rule that law 6 was added
for. Sonnet did those unprompted.

The forced arm is 38% more code for the same feature set.

## Two things the gate cannot see

1. **C-forced declares `"test": "node --test test/"` and has no `test/`
   directory.** The command fails immediately. Every checker returned SHIP.
2. **Nothing runs the app.** All three arms import a CSV correctly once
   set up; C requires `npm run migrate && npm run seed` first, A and B
   self-initialise. The gate has no opinion about any of this. An earlier
   reading of this file recorded C as failing its own example import —
   that was my error: I skipped the documented setup step. Corrected here.

## Reading this honestly

The suite's value on this task was **artifacts, not code quality**. Where
the arms differed, they differed in what was written down for a human to
read later. Where they were supposed to differ — security laws, schema
discipline, CLI contract — the model already complied without being told.

That does not make the artifacts worthless; a `PRODUCT.md` and an
`ARCHITECTURE.md` are the thing a reviewer reads in six months, and the
control produced neither. It does mean "evidence-gated shipping" currently
means "evidence that documents exist", and the phrase should not be used
loosely.

n=1 per arm, one model tier, one task. A weaker model, or a task with more
room to get security wrong, may separate the arms on code. This one did
not.

## What it implies

1. **The gate needs one check that the thing runs** — a build/test/boot
   smoke step. A repo whose test script points at a missing directory
   should not reach SHIP.
2. **Stop investing in prose mechanisms for invocation.** Two of three
   have now failed under measurement. The pre-commit hook, which asks the
   model for nothing, is the one that works.
3. **Skills with no checker and no positive eval should have to earn their
   place.** `testing-strategy` is a measured null, and not one arm here —
   including the forced one — wrote a test.
