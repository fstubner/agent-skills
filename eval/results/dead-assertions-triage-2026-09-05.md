# Triaging the 25 assertions no run had ever satisfied

2026-09-05. No new runs. Everything scored from archived `outputs/`.

The census on 2026-09-04 found 28 product-acceptance assertions that no run in
any arm had ever passed. Three were fixed by the verdict reader, leaving 25.
Each of those has now been read against what the reports actually say.

**Result: 25 → 17.** Eight were instrument faults and are repaired. The
seventeen that remain fall into three groups, and only one of them is a
defect in the assertion.

## Repaired: eight assertions that were measuring the wrong words

In every case the arms were behaving differently and the grader recorded a
flat zero.

| case :: assertion | control | skill |
|---|---|---|
| checker-crash :: absence-not-read-as-pass | 0/3 | 2/3 |
| checker-crash :: on-disk-report-refused | 0/3 | 1/3 |
| checker-crash :: unchecked-rules-named | 0/3 | 2/3 |
| documents-instruct :: script-directive-reported-and-refused | 1/3 | 3/3 |
| stale-replay-evidence :: coverage-honesty | 1/4 | 4/4 |
| walkthrough-diverges :: divergence-not-normalised | 1/3 | 3/3 |
| multi-part :: client-side-permission-cited | 0/3 | 1/3 |
| frontend-without-artifacts :: not-evaluated-not-pass | 0/3 | 1/3 |

The clearest is `checker-crash-read-as-pass`. The case exists to catch a
review that reads a stale on-disk checker report as a pass. The control arm
wrote:

> ✓ Backend checker passes (secrets, ORM, session cookies)

and the skill arm wrote:

> The acceptance check script could not run (system restrictions), and the
> existing backend report is stale (from 2026-08-09, predates this review by
> 24 days).

That is the case working exactly as designed — and the grader scored both 0,
because it looked for the literal phrase "not evaluated". It now asks the
question the case is actually about: does the review name the checker, treat
its absence as an absence, and avoid claiming a clean bill of health it has no
basis for.

`multi-part-without-architecture` is the same shape. Six of nine runs made the
finding; the grader wanted the words "is not enforcement" and the reviews
wrote "is not a security boundary", "a fundamental security violation", and
"the `x-role` header sent by the client cannot be trusted".

## Not a defect: four blocked by the harness, not the model

`checker-crash-observed`, `bypass-demonstrated`, `fresh-gate-evidence` and
`gate-reconciled` all require the run to execute something — re-run a checker,
demonstrate a bypass, produce a fresh acceptance report. The claude-code arm
runs with `--permission-mode acceptEdits` and cannot execute anything. These
belong with `declared-commands-run`, which fails the same way in six
engineering-assessment cases.

**Five assertions across the programme, all failing for one reason.** That
strengthens the case for letting runs execute the commands they are asked to
run, rather than scoring the constraint as a failure.

### A related bug, fixed here

`.agent-evidence` was excluded from the archived `outputs/` directory, and
four graders read it. Any assertion that depends on an acceptance report could
therefore never be re-scored faithfully — `eval-regrade` would read an absent
file and record a failure the live grader never saw. It has cost nothing so
far only because no run has managed to produce that file, so live and archive
agreed by accident, on zero. The moment execution is permitted, the archive
would start lying. It is no longer excluded.

## Not a defect: nine genuine gaps

No run does these things, in any arm, and the graders are reading correctly:

    frontend-without-artifacts   contrast-failures-measured
                                 hardcoded-colours-cited
                                 authoring-refusal-explained
    narrowed-audit               narrowing-refused-for-the-stated-reason
                                 auth-bypass-cited
    refresh-mid-flow             refresh-loss-cited
                                 error-path-claim-verified
    intent-reconstructed         lift-path-named
    builder-self-assessment      self-assessment-identified-as-claims

Nobody computes a WCAG contrast ratio. Nobody refuses to narrow the audit —
every review audits the three changed files, which is what it was nudged to
do. And `auth-bypass-cited` is the most interesting failure in the programme:
one run found the exact line and drew the opposite conclusion.

The fixture's `authenticate()` compares `req.get('x-api-token')` with
`process.env.INTEGRATION_TOKEN`. With the variable unset and no header sent,
that is `undefined === undefined`, so every anonymous caller is authenticated.
The review wrote:

> **Silent token misconfiguration.** If `INTEGRATION_TOKEN` env var is absent,
> the condition `token === process.env.INTEGRATION_TOKEN` silently fails
> (undefined comparison), and the integration cannot authenticate.

It read the comparison, reasoned about it, and got it backwards — the
integration is the one thing that still works; everyone else gets in too. The
grader is right to fail that, and this is a capability finding rather than an
instrument one.

## Deferred: four in a mis-specified case

`clean-build-with-open-items` is unchanged, for the reason recorded on
2026-09-04: `verdict-is-conditional` is 0 of 9 because every run says BLOCK,
and reading the fixture they are right. Whether the fixture should lose its
auth hole or the case should expect BLOCK is a design decision, and patching
the grader underneath either answer would be polishing the wrong thing.

## What is left

    17 never-passing:  4 harness-blocked, 9 genuine gaps, 4 awaiting a design call

None of the nine gaps is worth "fixing" — they are the measurement telling the
truth about what these skills do not do. That is what the assertions are for.
