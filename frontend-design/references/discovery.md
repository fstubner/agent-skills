# Discovery — Blank Slate Before Prescribing

This skill does **not** default to admin dashboards, dark sidebars, or enterprise chrome.
Start from a **neutral professional baseline** and let **context** choose the shape.

> **Discover → lock direction → build.** Do not pick an archetype, shell, or aesthetic until
> you have evidence from the user, the repo, or a discovery script.

## Scope tiers (pick one first)

| Tier | Examples | Direction lock | Typical gates |
|---|---|---|---|
| **Component** | Button, card, form field, modal | Optional | contrast, audit-ui, a11y |
| **Page / view** | Landing section, settings panel, checkout step | `design-direction.md` if net-new | + responsive, states, generic audit |
| **App / product** | Multi-route SPA, admin console, docs site | `product-brief.md` + `design-direction.md` | + layout CI, smoke, axe on routes |

**Do not run app-level CI** (layout shell, multi-route smoke, guardrails scaffold) for component-tier work.

## Discovery order

### 1. Run `profile-project.js` (always for non-trivial UI)

```
node "<SKILL_ROOT>/scripts/profile-project.js" [--root .]
```

Reads stack, styling system, existing tokens, component dirs. Writes `design-profile.json`.
**Respect what exists** — extend, don't replace (`design-systems.md`).

**Stack handoff:** If `needsStackInterview` is true, or framework is `Unknown / vanilla` on **page/app** tier without `stack-decision.md`, **stop UI polish** and invoke the **frontend-engineering** skill (`profile-stack.js`, stack interview, `stack-decision.md`). Do **not** treat vanilla as a permanent lock for multi-view apps. Do **not** default to React.

### 2. Classify what you can infer

| Signal | Inference |
|---|---|
| User says "landing page", "marketing" | **Brand** register → `visual-direction.md`, editorial/consumer archetypes |
| User says "dashboard", "admin", "settings" | **Product** register → `app-shell.md`, likely product archetype — **still ask** shell pattern |
| Existing `design-direction.md` / `product-brief.md` | Follow them; don't contradict without asking |
| Existing MUI / shadcn / Starlight / etc. | Use library shell — `shell-patterns.md` |
| Single component file touched | **Component tier** — skip full app workflow |
| Router + multiple views in repo | **App tier** — plan guardrails after direction lock |
| Nothing clear | **Stop and ask** (see below) |

### 3. When to ask the user (required if unclear)

Ask **before** `init-design-tokens.js` or layout/CSS when any of these are unknown:

0. **Stack** (page/app + unknown/vanilla) — owned by **frontend-engineering**; confirm one job-fit stack first
1. **Register** — product UI (tool/app) or brand/marketing (landing/editorial)?
2. **Audience & density** — who uses this and how much per screen? (drives archetype)
3. **Shell** (app tier only) — top bar, sidebar, hybrid, or none? Or extend existing chrome?
4. **Brand color** — hex or "match existing" (point at CSS var / logo)?
5. **Theme modes** — light only, dark only, or user-toggle dual theme?

Use `AskQuestion` or a short numbered list in chat. **One message, 3–5 questions max.**

Do **not** silently pick `enterprise` + `sidebar` because they are common in examples.

### 4. When scripts can substitute for asking

| Gap | Script / artifact |
|---|---|
| Stack unknown / vanilla on page|app | **frontend-engineering** `profile-stack.js` + interview → `stack-decision.md` (not “match vanilla forever”) |
| Stack already chosen | Extend that stack; design skill does not re-pick frameworks |
| No tokens | `init-design-tokens.js --archetype <chosen> --brand "#…" [--shell none\|sidebar\|topbar]` after archetype is **decided** |
| No direction doc | Write `design-direction.md` from answers + `visual-direction.md` template |
| No brief (app tier) | `PRODUCT.md` / `product-brief.md` — confirm with user; product-acceptance will BLOCK without it |
| Shell for CI | `init-ui-guardrails.js --shell sidebar|topbar` matching **locked** shell in direction doc |

Scripts **generate** artifacts; they do not **choose** product personality or stack for you.

## Lock direction (Phase 2.5)

After discovery, commit `design-direction.md` (five decisions in `visual-direction.md`).
For app tier, add `product-brief.md` when audience/voice are non-obvious.

**Archetype** (`enterprise` | `consumer` | `editorial`) comes from brief + register — not from skill defaults:

| Archetype | When — not default |
|---|---|
| Enterprise | B2B tools, dev consoles, dense data |
| Consumer | Consumer apps, friendly SaaS, mobile-first flows |
| Editorial | Marketing, magazines, storytelling layouts |

## Universal invariants (always — no product shape assumed)

These apply at **every** tier without picking admin vs marketing:

- Accessible contrast, focus, semantics (`accessibility.md`)
- All data views: loading, empty, error, success (`interaction.md`)
- Mutation feedback; no silent saves
- Responsive layouts unless user scoped to one form factor (`responsive-design.md`)
- Tokens over magic numbers when you own the stylesheet
- Sane UX inference **within the locked register** (`sane-defaults.md` § universal)

## Product-shaped defaults (only after discovery)

After register + archetype + shell are known, apply domain defaults from `sane-defaults.md` §
product — e.g. list-page CTAs for collection UIs, viewport lock for multi-route **sidebar apps**,
dual tokens when a theme toggle exists.

## Anti-patterns

| Wrong | Right |
|---|---|
| "I'll build a standard admin console" with no brief | Ask register + shell, or read existing context |
| `init-design-tokens.js --archetype enterprise` on every task | Archetype from discovery |
| `init-ui-guardrails --shell sidebar` on a landing page | Match guardrails to actual shell or skip |
| Skip questions because harness examples use Acme | Harness is a **benchmark**, not the default product |
| Unknown/vanilla → build a 1500-line `app.js` SPA | frontend-engineering stack interview + modular scaffold |
| Design skill picks React by default | Job-fit stack via frontend-engineering |

## Agent checklist

1. [ ] Ran `profile-project.js` (or read existing profile)
2. [ ] Scope tier chosen (component / page / app)
3. [ ] If `needsStackInterview` → frontend-engineering completed (`stack-decision.md`)
4. [ ] Unknown design forks resolved via **user questions** or existing brief/direction files
5. [ ] `design-direction.md` written before layout/CSS (page+ tiers)
6. [ ] Gates match tier (`verification.md`); product SHIP → product-acceptance (separate turn)
