# Professional Craft — Quality Bar

Use after direction lock and before claiming "done." This is the **taste layer** on top of
deterministic gates — what separates competent from exceptional.

Composes with `visual-direction.md` (five decisions) and Phase 4b in `SKILL.md`.

## Universal craft (every tier)

| Check | Standard |
|---|---|
| **Hierarchy** | Three distinct text levels visible at arm's length (display / body / meta) |
| **Tokens** | No magic hex/px in component CSS; spacing from scale |
| **Focus** | `:focus-visible` ring on every interactive element |
| **Motion** | Respect `prefers-reduced-motion`; hover gated `@media (hover: hover)` |
| **Semantics** | Native `<button>` / `<a>`; labels on inputs; `alt` on images |

## Product UI (after shell lock)

| Check | Standard |
|---|---|
| **Chrome split** | `chrome-bg` ≠ `content-well` when sidebar/topbar shell exists |
| **Data rows** | `font-mono` + tabular nums for IDs, metrics, session metadata |
| **States** | Loading, empty, error, success on every data view |
| **Primary action** | Obvious CTA per list/collection surface |
| **Viewport** | `100dvh` shell lock; scroll only in designated regions |

## Brand / editorial (no app shell)

| Check | Standard |
|---|---|
| **Display type** | `font-display` on hero and section titles — not sans for everything |
| **Accent roles** | Accent in ≥2 roles (CTA, eyebrows, badges, focus) — not one blue link |
| **Measure** | Body copy `max-width` ~38–42rem; generous vertical rhythm |
| **Craft move** | One deliberate layout choice (asymmetric grid, pull quote, mono rail) |
| **No admin chrome** | No sidebar, no dashboard cards unless brief asks for it |

## Component tier

| Check | Standard |
|---|---|
| **Variants** | primary / secondary / tertiary (+ destructive if actions) |
| **States** | default, hover, focus, disabled, loading |
| **API** | Props for variant/size/disabled/loading — no outer margin on root |
| **Tokens** | Use `--shell none` when generating tokens: `init-design-tokens.js --shell none` |

## Phase 4b polish pass (agent checklist)

Before ship, verify in code + screenshot:

1. [ ] Phase 2.5 decisions visible in the built UI (not just in the doc)
2. [ ] `audit-generic.js` score ≤2 (register-aware)
3. [ ] `audit-ui.js` warnings addressed or justified
4. [ ] `check-tokens-contrast.js` all PASS
5. [ ] Mobile: no horizontal overflow at 390px (page + app)
6. [ ] 5-second test: user knows what this is and what to do next
7. [ ] Generic test: name one tell you **avoided** and one craft move you **added**

## Anti-slop tells (reject these)

- system-ui + `#2563eb` + flat white card on gray
- Every heading the same weight/size
- Sidebar on a landing page "because examples use it"
- `outline: none` without replacement
- Silent saves; spinners with no success feedback
- Fixed 3-column grids with no mobile stack
