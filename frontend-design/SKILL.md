---
name: frontend-design
description: >-
  Visual design laws for intentional, accessible UI: direction lock, tokens,
  type/color/motion craft, anti-slop. Use when styling or visually reviewing UI.
  Not for stack choice (frontend-engineering), flows (frontend-ux), or product SHIP
  (product-acceptance). Interview before inventing aesthetics.
---

# Frontend Design

You own **visual system and craft**. Prefer laws over rituals. Scripts prove claims;
they are not the design process.

**Suite:** stack → `frontend-engineering`; flows → `frontend-ux`; SHIP → `product-acceptance`.

## Visual laws

1. **Direction before decoration** — page/app work locks `design-direction.md` (five decisions) before layout inventiveness (`visual-direction.md`).
2. **Tokens over magic numbers** — color, space, type, radius, elevation from a contract; raw hex/px in components is a defect.
3. **Hierarchy is readable at arm’s length** — at least three clear text levels; accent has a job, not confetti.
4. **One signature, quiet surroundings** — spend boldness once; cut accessory chrome.
5. **Contrast and focus are non-negotiable** — prove contrast; visible keyboard focus.
6. **Composition over one-off layout** — outer spacing is the parent’s job; prefer layout primitives.
7. **Match the locked stack** — never introduce a competing styling paradigm after eng locked stack.
8. **Refuse slop defaults** — no Inter/Roboto/Arial-by-habit, no purple-gradient template, no card grid for its own sake (`anti-patterns.md`, `professional-craft.md`).
9. **Stack before polish** — if profile says unknown/vanilla on page/app without `stack-decision.md`, stop → **frontend-engineering**.
10. **Visual critique ≠ product SHIP** — `design-critique` is visual; outcome acceptance is a separate skill/turn.

## Interview (do not invent)

Before tokens/chrome on page/app: register, brand accent, theme, shell (if app).  
Primary job/states → **frontend-ux** / **build** interview — do not fake them as “design.”

## How to work

1. Discover scope (`discovery.md`); hand off stack if needed.
2. Lock direction + tokens when you own the surface.
3. Load only the reference the task needs (table below).
4. Prove visual claims when shipping — see `references/verification.md` (gates/scripts live there, not as the skill’s center).

| Concern | Reference |
|---|---|
| Blank slate / handoff | `discovery.md` |
| Direction lock | `visual-direction.md`, `project-context.md` |
| Color / type / tokens | `color.md`, `typography.md`, `design-systems.md` |
| Craft / anti-slop | `professional-craft.md`, `anti-patterns.md` |
| Shell / sticky / responsive | `app-shell.md`, `sticky-and-scroll.md`, `responsive-design.md` |
| Motion / depth | `visual-mechanics.md` |
| Visual a11y | `accessibility.md` |
| Gates / scripts | **`verification.md`** |
| Visual critique | `design-critique.md` |

`<SKILL_ROOT>` = this skill directory. Set `FRONTEND_DESIGN_SKILL_ROOT` in CI if needed.
