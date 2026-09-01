# Delivery: why doesn't a visible, matching skill fire?

Design sketch, rewritten 2026-09-01. The first version of this file was wrong
and is worth reading as a lesson before the rewrite.

## The version this replaces, and why it failed

The first sketch assumed skills fail to fire because the model cannot see
them, and proposed four arms with a startup hook injecting the skill listing
as the main treatment. It was going to cost about 144 agent runs.

Four probes at roughly $0.15 total killed it before it ran
(`probes-2026-08-31.json`):

- **Skills are already visible.** `claude -p` lists every installed skill by
  name — about 44 on this machine, from four sources — including a
  project-level one planted in `.claude/skills/`. The hook arm was solving a
  problem that does not exist.
- **A near-exactly matching skill still does not fire.** A skill named
  `zqx-handler` (deliberately uninformative) described as "use this whenever
  the user asks about calibrating a hydrofoil trim tab" did not fire on "How
  do I calibrate a hydrofoil trim tab?". The reply contained none of the
  skill's planted figures.
- **A standing instruction did not fix it.** `CLAUDE.md` reading "check the
  list of available Agent Skills and invoke any whose description matches"
  changed nothing. That was arm C.

Two of four arms dead, and the premise of the whole design falsified, for the
price of four single runs. The lesson worth keeping: **the assumption
underneath an experiment is usually cheaper to test than the experiment.**

It also puts today's description work in its place. `eval-invocation.mjs`
measured ~87% selection by handing the model 17 descriptions and asking a
direct question. That is not the deployed condition — where ~44 names compete,
descriptions may or may not be present, and nothing prompts the question at
all. The 87% is real for what it measured and it does not license a claim
about live sessions.

## The question now

Not "can the model see the skills" but **why does a visible, matching skill
not fire?** Four candidate explanations, each testable at about one run each,
in rough order of how much they would change what we ship.

### Q1 — library size

This machine has ~44 skills from four sources. The skills survey reports a
phase transition in selection accuracy as a library grows, and the selection
harness tested 17 in isolation.

*Test:* the same `zqx-handler` probe in workspaces holding 1, 5, 17 and ~44
skills. If it fires at 1 and not at 44, selection pressure is the mechanism
and the answer is a smaller default install — which is also the tiered-install
question from the design review, in testable form.

### Q2 — model tier

Every probe used Haiku, and every recorded unprimed run used a small model.

*Test:* the same probe on Haiku, Sonnet and Opus. If firing is tier-dependent,
the suite's deployed value depends on which model the user runs, and that
belongs in `INSTALL.md` rather than being discovered.

### Q3 — harness mode

All four probes and both historical unprimed runs are non-interactive
`claude -p`. This session's own listing does carry descriptions, which hints
the two modes differ.

*Test:* the same probe interactively versus `-p`. Hard to automate — likely a
handful of manual sessions with the transcript kept. Worth doing even at n=3,
because if skills fire interactively and not in `-p`, then every invocation
number in this repository is an artifact of the harness rather than a property
of skills.

### Q4 — prompt shape

The probe was a bare question. The suite's skills are written for tasks in a
repository.

*Test:* the same planted skill against a task-shaped prompt in a populated
workspace. This one is closest to the eval cases and most likely to be the
condition the suite was actually designed for.

## Method, unchanged from the first version

One trial is: a scratch workspace, a real `claude -p` run on an ordinary task,
then the transcript inspected for whether a skill's content entered context —
a `Skill` tool call, or a `Read` of a `SKILL.md`. No judge, nothing to argue
about.

Use a planted skill with an uninformative name and invented figures in its
body, so that firing can only come from the description and use of the body is
detectable in the reply. Testing with the suite's own skills confounds firing
with the model already knowing the material.

Three outcomes per trial: fired-correct, fired-wrong, silent. The middle one
is a cost, not a partial win.

## Traps

**A fired skill is not a followed skill.** This measures delivery only.
Efficacy is the other programme's question and `eval/README.md` already warns
against conflating them.

**An arm that fires on everything has removed routing, not fixed it.** Carry
nonsense prompts through every arm and count a skill firing on "rename this
folder" against it.

**n=1 falsifies; it does not characterise.** The probes above are enough to
kill a hypothesis and not enough to explain anything. Any answer to Q1–Q4
needs replication before it goes in a README.

## What would make all of this moot

If skills only ever reach context through explicit user invocation — a
`/skill-name` call, or a harness that always injects them — then the efficacy
programme is measuring the right thing under the right assumption, and the
honest move is to write that assumption into `AGENTS.md` rather than keep
hunting for a way around it. Q3 is the probe most likely to settle that, which
is why it is worth the manual effort despite being the least automatable.
