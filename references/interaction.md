# Interaction: Behavior, States, and Usability

A UI is judged by how it behaves, not just how it looks. A beautiful component that gives no
feedback, has no empty state, or loses the user's work is a failure. Design the behavior with the
same rigor as the visuals.

## 1. Usability heuristics (the evergreen checklist)

Hold every interface against these. They're rules of thumb, not laws — but they catch most real
problems. (Full set + examples: NN/g, see `resources.md`.)

- **Visibility of system status** — the UI always shows what's happening: loading, saved, failed,
  how many items, where you are. Never leave an action with no acknowledgement.
- **Match the real world** — use the user's language and mental model, not internal jargon.
- **User control & freedom** — provide an obvious way out: cancel, back, close, and especially
  **undo**. Don't trap users in flows.
- **Consistency & standards** — same thing looks/behaves the same everywhere; follow platform
  and web conventions (Jakob's Law: users expect your site to work like the others they know).
- **Error prevention** — make mistakes hard: sensible defaults, constraints, confirmation only
  for the irreversible, format-as-you-type where it helps.
- **Recognition over recall** — show options and context; don't make users remember things across
  steps.
- **Flexibility** — keyboard shortcuts and accelerators for frequent users, without burdening
  first-timers.
- **Aesthetic & minimalist** — every extra element competes for attention; cut anything that
  doesn't earn its place.

Applied **Laws of UX** (see `resources.md`): **Fitts's Law** — frequent/important targets should
be larger and closer; **Hick's Law** — fewer choices = faster decisions, so chunk and progressively
disclose; **Miller's Law** — group related items (≈5–9 per group).

## 2. Every view has states — design all of them

For any view that loads or mutates data, design the full set, not just the happy path:

| State | Requirement |
|---|---|
| **Loading** | Skeleton matching the layout (see `visual-mechanics.md`); avoid layout shift |
| **Empty** | Explain why it's empty and give the next action (e.g. "No projects yet — Create one") — not a blank box |
| **Partial** | Show what loaded; indicate what's still coming or failed |
| **Error** | Specific, human message + a recovery action (Retry); never a dead end or raw stack trace |
| **Success/idle** | The normal content |

Expose the current state with a `data-state` hook so styling and agents can target it (see
`architecture.md`).

## 3. Feedback and latency

- **Immediate feedback (<100ms).** Acknowledge interaction synchronously before any async work —
  flip to a loading/disabled state, then start the request (see `architecture.md` §7).
- **Optimistic UI** for high-confidence mutations: apply the change immediately, reconcile on
  response, and roll back visibly on failure.
- **Announce async status** to assistive tech with a polite live region (`aria-live="polite"`),
  not just a visual spinner (see `accessibility.md`).
- Use the **motion + status tokens** from the design contract for transitions and state color.

### Status and error messaging

Pair **icon + text + color** — never a colored dot, bare text, or color alone:

| Tone | Pattern |
|---|---|
| Success | Check-circle icon + short confirmation ("Changes saved.") |
| Error | Alert-circle icon + specific, actionable message + recovery path |
| Info | Info icon + neutral status |

Render as a compact inline banner (subtle tinted background + border using `color-mix` with the
status token), not a floating dot beside a button. Field-level errors get the same icon treatment
inline below the control. The message text is what screen readers announce; icons are
`aria-hidden="true"`.

## 4. Forms (the highest-leverage surface)

Principles (delegate component anatomy to GOV.UK / APG in `resources.md`):

- **Labels are always visible** and associated with the control. Placeholders are not labels —
  they vanish on input and fail contrast.
- **Validate at the right time:** on blur or submit, not on every keystroke. Re-validate a
  corrected field on the next blur. Show errors inline next to the field *and* summarize at the
  top for long forms.
- **Error messages are specific and actionable:** "Enter a date in DD/MM/YYYY", not "Invalid".
- **Use the right input affordances:** correct `type`, `inputmode`, and `autocomplete`; this drives
  keyboards and autofill on mobile.
- **Required vs optional:** mark one or the other consistently across the whole form; don't mix.
- **`disabled` vs `readonly`:** disabled is unfocusable and excluded from submission; readonly is
  focusable and submitted. Avoid silently disabling submit with no explanation of what's missing.
- **One column** for most forms; related fields can share a row. Group with `<fieldset>`/`<legend>`.

## 5. Destructive and irreversible actions

- Prefer **undo** over an "Are you sure?" dialog — it's less interruptive and safer in practice.
- Reserve confirmation for the genuinely irreversible (permanent delete, payment), and make the
  confirm button name the action ("Delete 3 files"), not a generic "OK".

## 6. Navigation and orientation

- Keep the user's current location obvious (active nav state, breadcrumbs for depth).
- Keep primary navigation consistent across views; don't reshuffle it per page.
- Make destinations predictable from their labels — recognition over surprise.
