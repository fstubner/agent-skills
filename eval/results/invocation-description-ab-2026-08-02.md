# Does a sharper description fix invocation? No — 0/5

Direct test of the most obvious hypothesis about the ~0% invocation
finding: that the descriptions are simply not written well enough for the
model to recognise when a skill applies.

## Why re-test at all

The original ~0% came from tag `v1.0.0-alpha.1`, installed to
`~/.claude/skills` by `install.mjs` — **not** as a plugin. Twelve releases
and a plugin-packaging change later, that measurement was stale enough not
to lean on. Re-run against the current install.

## Confound ruled out first

A Task-tool subagent was asked, without reading any files, whether it had
a `Skill` tool and which skills it could see. It listed **all 17
`agent-skills:*`** plus skills from seven other plugins. So the skills are
present, namespaced and visible; anything that follows is the model
declining to reach for them, not a discovery failure.

## Arms

Identical unprimed prompts, no skill mentioned, haiku-4.5 subagents,
current plugin install with the telemetry hook registered.

**Variant A** — the shipped description:

> Entry point for greenfield or ambiguous product-UI requests: a brand new
> app, a "build this" request, a dashboard or tool MVP…

**Variant B** — rewritten to be maximally trigger-matched: leads with "Use
this FIRST, before writing any code", quotes the literal phrasings a user
would type ("build me an X", "can you get started on X", "I need an app for
X"), and states the cost of skipping it.

| Variant | Trials | Skill calls | Skill artifacts produced |
|---|---|---|---|
| A (shipped) | 2 | **0** | 0 |
| B (trigger-matched) | 3 | **0** | 0 |

Prompts used for B were deliberately varied in surface form — a climbing
gym app, a book-club tracker, a warehouse dashboard — including the exact
phrases the description now quotes. Every trial went straight to code.

## Conclusion

**Description quality is not the lever.** A description written to match
the user's literal words, leading with an imperative, naming the cost of
skipping, changed nothing. Five for five.

The competing explanation that survives: the model has a strong prior to
just *do* the obvious task, and a name-plus-description in a list of 100+
skills from eight plugins does not displace it. That is consistent with the
earlier finding that a competing plugin's far more aggressive mechanism —
injecting a whole skill's text via `SessionStart` — also failed to fire
reliably.

## What this does not establish

- **Model tier.** All five trials are haiku-4.5. The original study included
  two sonnet-5 runs, also 0, but nobody has tested opus, and a larger model
  may weigh an available skill differently.
- **That no description could work.** One rewrite, one skill. A different
  framing might succeed; this rules out the cheap version of the idea, not
  the idea.
- **Top-level sessions with a real human.** All five are subagents. The
  original study included a genuine top-level `claude -p` session (also 0),
  but that was the old install path.

## Consequence for the suite

Nothing changes in what is *shipped* — the variant-B description was
reverted, because it made no measurable difference and its pushier voice
("skipping it means building the wrong thing quickly") overstates a case
the evidence does not support.

What it confirms is the standing recommendation in
[INSTALL.md](../../INSTALL.md#installing-is-not-the-same-as-invoking): the
mechanisms that reliably fire are the ones that do not ask the model to
choose — a `CLAUDE.md` directive, a `SessionStart` hook, or a git hook
running the checkers directly. Skill descriptions are not one of them.
