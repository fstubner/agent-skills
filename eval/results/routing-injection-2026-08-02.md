# Routing injection: skills fire now — just not ours

Third experiment on the invocation problem, and the first one that moved
anything.

## Setup

A `SessionStart` hook injects `routing/routing.md`, a trigger-to-skill
table, into every session (~2KB). Same three unprimed prompts as the
description A/B, same model, same subagent harness. The
`PostToolUse` telemetry hook records any `Skill` call, so invocation is
observed rather than inferred.

## Result

| Condition | Trials | Skill calls |
|---|---|---|
| No routing, shipped description | 2 | 0 |
| No routing, imperative description | 3 | 0 |
| **Routing injected** | 3 | **2 — both `superpowers:*`** |

```
2026-08-03T02:07:49Z -> superpowers:brainstorming
2026-08-03T02:08:28Z -> superpowers:writing-plans
```

Zero `agent-skills:*` calls. Zero `PRODUCT.md`, `design-direction.md` or
any other artifact. All three trials shipped a single HTML file.

## What this changes

The problem is not that skills never fire. Across five earlier trials
nothing fired at all — from *either* plugin, and `superpowers` was
installed throughout. With the routing table injected, skills fired.
Something about stating "use a skill for this kind of request" every
session moved the model off its default.

**It then picked a different plugin's skill.** `superpowers:brainstorming`
declares:

> "**You MUST use this before any creative work** — creating features,
> building components, adding functionality, or modifying behavior."

Against that, `product-build`'s "Entry point for greenfield or ambiguous
product-UI requests" is a description of a category. One is an instruction,
the other is a label, and the instruction won on a prompt both cover.

Note this also explains why the earlier description A/B came back 0/3 even
though variant B *was* imperative ("Use this FIRST, before writing any
code"): without the routing hook, no skill fired at all, so nothing was
being selected between. Force in a description and salience of skills as a
category look like two separate effects, and this run cannot separate them
— it only shows that with salience raised, the MUST-phrased description
takes the request.

## Honest limits

n=3, one model tier (haiku), subagents only. Two invocations is a thin
basis for "routing works" — the correct reading is "routing moved
something, in one direction, once". A larger run would settle whether the
effect is real and whether it reproduces without `superpowers` installed.

The competitive framing is also specific to this machine: eight plugins,
100+ skills, an unusually crowded field. A user with only agent-skills
installed faces a different selection problem entirely, and that case is
untested.

## Open decision, not taken here

The obvious next move is to make `product-build`'s description imperative
in the same way, or have the routing table claim precedence explicitly. I
have not done either, because it is an arms race with a real cost: if every
skill in every plugin opens with "You MUST", the signal is gone for
everyone and the crowded-field problem gets worse. That is a judgment call
about how aggressive this suite should be toward its neighbours, not a
technical one.
