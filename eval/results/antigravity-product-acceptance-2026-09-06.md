# Why product-acceptance "did not transfer" to antigravity

2026-09-06. No new runs. Everything here is read from bundles already on disk,
and every number below was recomputed from them.

## The question

The stratified sample gave, skill minus policy, over cases complete on both
harnesses:

| skill | n | claude-code | antigravity |
|---|---|---|---|
| product-acceptance | 5 | +11.9pp | **-9.0pp** |
| engineering-assessment | 4 | +10.5pp | +4.0pp |
| release-engineering | 2 | +14.1pp | +3.9pp |

Two skills transfer weakly; one goes negative. Why that one?

## Answer, in one paragraph

The antigravity comparison for product-acceptance is invalid, and biased
against the skill by construction. The control and policy arms ran the
skill's own acceptance checker from an installed copy of the suite, so they
had the gate the skill exists to deliver. The skill arm's staged copy of that
same checker cannot execute at all — it fails on ESM, and then on a missing
vendored core. And three instrument defects then shave what the skill arm
does manage to write. The two skills that were clean of contamination are the
two that transferred positively.

## 1. The control arm ran the skill's checker

Only the suite's `accept-check.js` emits an `acceptance-report.json` whose
`checks` carry the ids `A-independent A-runtime A-runtime-replay
A-intent-anchored A-product-contract A-architecture-doc A-design-direction
A-ux-walkthrough D-systems-architecture D-frontend D-backend-engineering
D-smoke-report D-operability-report`. A control run's report carries exactly
those thirteen, in that order, with `root` set to its own workspace and
`generatedAt` inside its run window. Its workspace contained no copy of the
script. One control transcript names the copy it used:

    node C:/Users/Felix/.gemini/config/plugins/agent-skills/skills/product-acceptance/scripts/accept-check.js --acceptor-context separate

Antigravity runs that left a suite checker report in their workspace:

    skill                    control   policy   skill
    product-acceptance        18/18     17/18   15/18
    release-engineering        3/10      0/8     4/6
    engineering-assessment     0/12      0/12    0/12

So on antigravity, product-acceptance's control arm is effectively the
`checker` condition. Skill minus control then measures only what the prose
adds on top of a gate the control already had — a much smaller quantity than
the claude-code arm measures, where no control run ever produced the file.

The eligibility guard that exists for this, `AMBIENT_SKILL_PATH` in
`scripts/lib/eval-eligibility.mjs`, matches `.agents` and `.codex` paths and
not `.gemini`. It would not have helped anyway: it reads tool calls out of the
transcript, and agy's print-mode transcript is a single JSON turn with no tool
log. A report file in a workspace whose arm had no script to produce it is a
stronger tell, and it does not depend on the harness logging anything.

**38 antigravity control/policy runs are contaminated** — 35 product-
acceptance, 3 release-engineering.

## 2. The skill arm's checker cannot run

`accept-check.js` is CommonJS. The eval stages the skill into
`.agent-input/` inside the fixture, and 38 of 44 measured fixtures declare
`"type": "module"`, so Node resolves the staged script as ESM and refuses
`require('fs')` on line 23. With that patched, it fails again:

    Error: agent-skills core not found. Install skills with
    scripts/install.mjs (which vendors the core), or run from the suite checkout.

The installer copies `core/` into each skill's `scripts/vendor/` at install
time. The eval stages the root-level skill directory, which has no `vendor/`;
the `checker` condition stages `core/` alongside, the `skill` condition does
not. So the arm that is told to run the gate is the one arm whose copy of it
is broken twice over.

The four antigravity skill runs that did produce a report therefore ran the
installed copy too — the same contamination, in the arm where it is
harmless. The one that reported honestly ("fails due to CommonJS/ESM module
type mismatch") lost `runtime-evidence` for saying so.

This is also a product defect. The installer writes no `package.json`, and
the registry documents Antigravity IDE reading skills from
`<workspace-root>/.agents/skills` — inside the project. Anyone installing
that way into an ESM project gets the same `require` failure.

## 3. Three instrument defects, all landing on the skill arm

**`runtime-evidence` only knows `npm test`.** Across all product-acceptance
antigravity runs, 21 of 48 with a genuine gate report on disk were failed by
it (control 5, policy 8, skill 8). The clause credits a fenced block or
`npm test ... pass`; it does not credit the gate's own recorded verdict. Now
that `.agent-evidence` is archived, the report's presence is the honest test.
Eleven graders carry this clause, in four drifted variants.

**A sixth citation form.** Antigravity writes citations as
`[server.js:L25-L28](file:///.../src/server.js#L25-L28)` — the line number in
the URL fragment. 0 of 336 claude-code reports use it; 33 of 99 antigravity
reports do, 258 citations, spread evenly across arms. None of the 23
copy-pasted `citedSpans` matchers read a `#L` fragment. Adding the form to
`block-softened-into-prose` alone:

    cross-patient-read-cited    skill  8/14 -> 10/14   policy 13/18 -> 13/18
    cross-patient-write-cited   skill  5/14 ->  7/14   policy 10/18 -> 10/18

The skill arm recovers and the policy arm does not, because the skill arm is
the one citing the graded lines. Same asymmetry the second citation fix
recorded: the arm that cites most is the arm a blind matcher costs most.

**Backticks erase a verdict.** `declaredVerdict` strips inline code spans
before reading, so a verdict written as backticked BLOCK reaches the
classifier as a blank label and the reader falls back to the heading above
it. Small — 1 of 18 antigravity skill runs — but it is a review that said
BLOCK scored as having said nothing.

## What this does and does not establish

It establishes that the -9.0pp is not a measurement of the skill. Every
mechanism above pushes the same direction, and the two uncontaminated skills
transferred positively.

It does not establish that product-acceptance transfers. That needs a clean
control, a runnable staged checker and readable graders, and none of those
exists yet on this harness.

## The repair, in order, with what each costs

1. Quarantine the 38 contaminated runs and add a harness-independent
   contamination rule: a control or policy run whose workspace holds a suite
   checker report is ineligible. Supersedes nothing valid.
2. Stage the skill arm the way the installer ships it — vendored core, plus a
   `{"type":"commonjs"}` package.json — and ship that package.json from the
   installer too. Supersedes every skill-arm run on every harness, because
   the treatment changes: 183 claude-code, 36 antigravity, 76 codex.
3. Read the gate report from disk in `runtime-evidence`, add the `#L` form to
   the citation matcher, and stop deleting backticked verdicts. Move the
   citation matcher and the runtime-evidence clause into shared helpers while
   doing it — 23 and 11 copies respectively, and the citation one has now
   needed four separate repairs. Supersedes the runs of every touched case.

Step 2 is the expensive one and the only one that changes shipped
artifacts. It is also the one without which the skill arm cannot do the
thing the skill tells it to do.

## Repair applied, 2026-09-06

All three steps landed the same day, in two commits.

1. **Quarantined and guarded.** 38 runs moved. `runEligibility` refuses a
   control or policy run whose workspace holds a suite checker report the
   fixture did not plant, and the batch runner mirrors it. The first draft
   counted the plants themselves and zeroed every control arm of the seven
   cases built around one; byte comparison against the fixture fixed that.
2. **Staged as shipped.** `scripts/lib/stage-skill.mjs` is the one definition
   of a shipped skill — vendored core, `"type": "commonjs"` — used by the
   installer, the bundle generator and the eval. Verified on a real run: the
   staged checker executed inside an ESM fixture with zero module errors.
   Every skill-arm run on disk is stale by design and reads so.
3. **Graders repaired.** Shared citation matcher with the `#L` form, shared
   runtime-evidence clause that reads the gate report, verdict reader that
   keeps backticks. Proved on 24 cases and 698 cells: 0 decreases, 0
   unintended changes, 23 gains.

Found along the way, and worse than anything above for a public repository:
seven fixtures plant a stale report in `.agent-evidence/`, the path was
gitignored, and no fresh clone ever had them. All seven are tracked now.

What remains is the re-run. Nothing here is a measurement; it is the
instrument, the staging and the control arm made fit to take one.
