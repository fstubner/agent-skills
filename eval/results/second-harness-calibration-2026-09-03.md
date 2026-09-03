# Choosing a second harness: the cases are model-specific, not simply "easy"

Date: 2026-09-03. Codex quota is exhausted, so the pre-registered second
harness cannot run. Cursor has no adapter and no CLI installed. Antigravity
(`agy`) works, which leaves one question: on which model?

Control-only calibration, deliberately. The control arm never sees a skill, so
picking a model on control scores cannot bias the skill comparison that
follows. Five cases spanning haiku's difficulty range, one trial each.

## Result

| case | haiku control | haiku skill | gemini-3.6-flash-low | gpt-oss-120b-medium |
|---|---|---|---|---|
| refresh-mid-flow-loses-work | 0.444 | 0.407 | 0.222 | 0.222 |
| circular-dependency-god-module | 0.583 | 0.542 | 0.250 | 0.250 |
| declared-commands-fail | 0.333 | 0.741 | 0.222 | (run failed) |
| engineering-assessment-hidden-risks | 0.000 | 0.533 | **1.000** | 0.000 |
| plumbing-directory-blindspot | 0.306 | 0.750 | **0.917** | 0.083 |
| **mean** | **0.333** | — | **0.522** | **0.139** (4 of 5) |

Plus, from an earlier pilot on `plumbing-directory-blindspot`:
`gemini-3.8-flash-medium` control **1.000**, `gemini-3.8-flash-low` **0.833**.

## What this actually says

**Gemini is not uniformly stronger.** It is far better than haiku on two cases
and *worse* on the other three. The mean hides a bimodal split: 0.22, 0.25,
0.22 — then 1.00, 0.92. The two it aces are the two engineering-assessment
cases in the sample; the three it does poorly on are one from each of the
other skills.

So the earlier conclusion, drawn from one case, was too broad. "Gemini has
outgrown these cases" is not supported. **Case difficulty is model-specific.**

The likely mechanism, unconfirmed: both cases Gemini aces are graded largely
on citing specific files and lines, and models differ enormously in whether
they cite by default. `engineering-assessment-hidden-risks` scores its
citations as one all-or-nothing conjunction over three risks — haiku gets 0.000
and Gemini 1.000 on the same rubric. That is a construct-validity worry worth
its own investigation: a case meant to measure assessment quality may be
substantially measuring citation habit.

**gpt-oss-120b-medium is unreliable here.** Two of six attempted runs returned
`agy` status ERROR ("our servers are experiencing high traffic"), zero
response, one turn. It also floors on the two cases Gemini ceilings on, so it
carries no signal there either.

## What it means for the second harness

No available model reproduces haiku's conditions. Whichever is chosen, roughly
two of five cases will sit at a ceiling or a floor and can carry no signal —
and a ceilinged case can only ever produce a delta of zero or less, which
biases an average downward for reasons that have nothing to do with the skill.

`gemini-3.6-flash-low` is the better of the two: no failed runs, and headroom
on three of five cases. Any arm run on it must report the headroom subset
alongside the full average, not instead of it.

## What it means for the suite

The question that prompted this was whether the skills should do less, on the
grounds that better models need less help. This data does not support that.
Gemini is better than haiku at two of these five cases and worse at three; it
is a different model, not a uniformly stronger one.

It does support something narrower and more useful: **an effect measured on
one model does not transfer to another**, and the suite's claim should say
which model it was measured on. The completed arm says "on claude-haiku-4-5".
That is a smaller claim than "these skills work", and it is the one the
evidence carries.

## Reproducing

The calibration is control-only and cheap:

```bash
node scripts/eval-run.mjs --case <id> --condition control --harness antigravity --model <model>
```
