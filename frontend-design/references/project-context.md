# Project Context — Persistent Design Memory

Agents forget between sessions. **Write context once** so every build and critique pass reads the same brief.

**Discovery first:** if these files don't exist and the task is not a trivial component tweak, run
`profile-project.js` and **ask** the user (`discovery.md`) — do not invent an admin dashboard personality.

## Files (pick what fits)

| File | Purpose | When |
|---|---|---|
| `product-brief.md` | Audience, jobs-to-be-done, voice, anti-references | App tier or ambiguous greenfield |
| `design-direction.md` | Phase 2.5 five decisions (required for page + app tiers) | Before layout/CSS on net-new surfaces |
| `design-profile.json` | Stack detection from `profile-project.js` | Auto-generated Phase 0 |

Templates: `templates/project-context/`

## product-brief.md (app tier or unclear register)

```markdown
# Product brief

## Audience
Who uses this and in what context?

## Register
product | brand

## Voice
Professional / friendly / technical — one line.

## Anti-references
What this must NOT look like (e.g. "generic blue admin", "Dribbble glassmorphism").

## Primary surfaces
List fragile areas: dashboard, docs, settings, search modal, …
```

Scaffold from template, then **confirm** key fields with the user if you inferred them.

## design-direction.md (page + app tiers)

See `visual-direction.md` — the five decisions (archetype, type, surfaces, accent, craft move).

## Agent rule

Before Phase 3 on page/app work:

1. Run `profile-project.js` (or read existing `design-profile.json`).
2. If `openQuestions` is non-empty → **ask user** before `init-design-tokens.js` or shell CSS.
3. Read or create `product-brief.md` (app tier).
4. Read or create `design-direction.md`.
5. Do not contradict written context without asking.

## CI linkage

`ci-check --strict` fails if app-shell markup exists but `design-direction.md` is missing.
Guardrails `--shell` must match the shell recorded in direction docs — not a skill default.
