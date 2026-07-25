---
name: learn-from-session
description: >-
  Turn something that happened this session into something durable — a rule
  added to a skill, a regression fixture, a project convention, or a
  memory entry — instead of fixing it once and letting the same mistake
  recur. Triggers when a correction just happened (yours or the human's),
  when a fix reveals a class of problem rather than a one-off, when a
  non-obvious approach just got confirmed as right, or when explicitly
  asked what was learned. Not for routine work that went as expected —
  most of a session is not lesson material, and treating it as such
  produces noise that buries the few things actually worth keeping.
---

# Learn from session

Most of what happens in a session is not worth remembering — it's the normal
work the skills already cover. The moments worth capturing are narrower:
something surprised you, a mistake had a shape likely to recur, or a
non-obvious call just got validated. This suite's own history is the
worked example: a fail-open bug in `ai-prose-slop`'s Vale-error handling
wasn't just patched — it became two independent regression tests (one in
`gen-patterns.mjs`, one in `check-prose.js`) specifically so the same class
of bug can't silently ship again. That conversion — one-off fix to durable
artifact — is this skill's whole job.

No shared artifacts, no checker script — deciding what's actually worth
keeping is judgment, and a script that captured everything would produce
exactly the noise this skill exists to avoid.

## Triage: what kind of moment is this

| What happened | Destination |
|---|---|
| A mistake with a mechanical, checkable shape (a bug a test could have caught) | A regression fixture or check, in the relevant skill |
| A mistake or gap in how a skill instructs behavior (a rule was missing, weak, or wrong) | An edit to that skill's `SKILL.md` or `references/` |
| A convention specific to one project, not generalizable to the skill itself | That project's own `CLAUDE.md`/`AGENTS.md`, not this suite |
| A non-obvious approach that just got confirmed as the right call | Worth recording specifically because it wasn't obvious — the same bar as a correction, just the opposite verdict |
| Something genuinely one-off, unlikely to recur, already fully handled | Nowhere. Not every fix is a lesson. |

## Rules

1. **Capture the why, not just the what.** "The prompt-injection rule was
   too weak" is a fact; "it was too weak because it let a model reason
   itself into treating an urgent-sounding embedded instruction as
   authorized, so the fix needed an explicit don't-revisit-under-pushback
   clause, not just a stronger warning" is the version that helps someone
   avoid the same failure differently next time. This is `mental-models`'
   record-the-why applied at the scale of a whole session instead of one
   decision.
2. **A confirmation is as worth keeping as a correction.** A non-obvious
   choice that worked (keeping `frontend`/`backend-engineering` asymmetric
   on purpose, re-running acceptance checks fresh instead of trusting
   cached reports) is exactly as easy to accidentally "fix" back to the
   naive version later if it was never written down as intentional.
3. **Match the destination to the scope.** A durable fixture belongs in the
   skill whose checker it tests, not in a generic notes file. A one-off
   project convention belongs in that project, not upstreamed into a
   general-purpose skill where it will misfire on the next project that
   doesn't share it.
4. **Don't let "this might be useful someday" justify capturing everything.**
   The discipline is the same one `code-smells` applies to speculative
   generality: a lesson earns a durable home by having actually mattered
   once, not by seeming like it plausibly could someday.
5. **When the mistake is mechanical, prefer a test over a note.** A note
   says "remember not to do this"; a regression fixture makes doing it
   impossible to ship unnoticed. Reach for `testing-strategy`'s discipline
   (pin the specific failure, not just "it broke once") whenever the lesson
   can be expressed as a check rather than only as prose.
