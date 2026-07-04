# Sane Defaults — Infer the Obvious (Within Locked Context)

When the user, spec, or ticket **does not spell something out**, apply defaults — but **only after
discovery** (`discovery.md`). This skill does not assume admin, marketing, or any single product shape.

> Literal spec compliance without inference is a defect — not a virtue.
> Prescribing the wrong product shape without asking is also a defect.

## Two layers

### Layer A — Universal (always, any UI)

Apply without picking an archetype:

| Invariant | Default |
|---|---|
| **Accessibility** | Contrast check, visible focus, semantic HTML, labels on forms |
| **States** | Loading, empty, error, success on any data view (`interaction.md`) |
| **Mutations** | Immediate feedback; toast or inline banner — never silent success |
| **Destructive actions** | Confirm; reversible where possible |
| **Responsive** | Mobile + tablet + desktop unless user scoped one form factor; no horizontal overflow (`responsive-design.md`) |
| **Forms** | Visible labels, inline errors, loading on submit |
| **Theme toggle present** | Ship working dual theme (tokens + visual verify) — or remove the toggle |

### Layer B — Product-shaped (only after register + archetype + shell are known)

Do **not** apply until `design-direction.md` / user answers define the product:

| Context (examples) | Inference |
|---|---|
| **Collection / list UI** in a product app | Primary CTA for the collection noun in page header |
| **Detail view** | Back to list; scoped actions; tabs if multiple sub-views |
| **Settings with ≥2 sections** | Secondary nav appropriate to shell |
| **Multi-route app shell** (when shell is chosen) | Viewport plan per `app-shell.md` + `responsive-design.md` |
| **Dashboard-style home** | Summary + activity — only if brief says dashboard |

If you don't know whether the UI is a collection page, a marketing hero, or a settings form —
**ask** (`discovery.md`), don't default to "Projects + Create button."

## When to ask vs infer

| Situation | Action |
|---|---|
| Register unclear (product vs brand) | **Ask** |
| Shell unclear on greenfield app | **Ask** |
| Archetype / brand color unknown | **Ask** or run brief template + confirm |
| User said "list of X" in a product app | Infer list-page CTA (Layer B) |
| User added theme toggle | Infer dual theme (Layer A) |
| Behavior-only spec, app tier, brief exists | Infer Layer B from brief + direction |

## Phase checklist (before claiming done)

**Universal (all tiers):**

1. [ ] States + mutation feedback on touched views
2. [ ] Responsive check on touched surfaces (if multi-column or full page)
3. [ ] Theme toggle → both themes work visually (if present)

**Product-shaped (page + app, after direction lock):**

4. [ ] Primary actions visible for the **actual** IA (not a template from another product)
5. [ ] Shell behavior matches locked direction (not a default sidebar)
6. [ ] Assumptions documented in `design-direction.md` if you inferred Layer B

## Anti-pattern: "not in the spec"

| Excuse | Reality |
|---|---|
| "I'll use enterprise sidebar like the examples" | Examples are one archetype; discover yours |
| "SPEC didn't say create button" | Infer only when IA is clearly a collection UI |
| "Smoke passed on dark toggle" | Verify visuals, not just `data-theme` |

## Critique hook

Interaction specialist: *"What would a user try first on **this** page?"* — judged against the
**locked brief**, not a generic admin template.
