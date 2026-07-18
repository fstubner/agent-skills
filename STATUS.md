# Status and known gaps

**Suite version:** see [VERSION](./VERSION)  
**Maturity:** beta — production-capable for informed teams; not proven across many unprimed agents

## Philosophy (non-negotiable)

Skills encode **laws, principles, and decision procedures**.  
They do **not** center on scaffold recipes or “run every script” rituals.  
Dated tool examples may live only in `recipes/` and must not define skill identity.

## Addressed (0.2.0)

| Prior gap | Resolution |
|---|---|
| UX / PM / backend charter-only | Promoted to thin skills: `frontend-ux`, `product-management`, `backend-engineering` |
| Design skill script-first | `frontend-design` SKILL.md is principles-first; gates live in `references/verification.md` |
| No versioning / gaps for consumers | `VERSION`, `CHANGELOG.md`, this file, README maturity section |
| Agents skip suite unless told | `build` description/triggers strengthened; README + INSTALL tell harnesses to install **`build`** as the entry skill; unprimed protocol below |

## Still open

| Gap | Why it remains | What closes it |
|---|---|---|
| Limited unprimed field evidence | Needs real runs without coaching prompts | Run [Unprimed evaluation](#unprimed-evaluation) and file results as issues |
| Recipe drift in dated files | Ecosystem moves | Rewrite `recipes/YYYY.md` only; leave core refs alone |
| Backend skill has no hard scripts yet | Property skill first | Add contract checks when a stable pattern appears across projects |
| Claude.ai cloud upload UX varies | Platform UI | Follow INSTALL.md Customize path; report breakage |

## Unprimed evaluation

Use this to gather evidence that agents follow the suite **without** restating the pipeline in the user prompt.

1. Install all skills for the harness ([INSTALL.md](./INSTALL.md)). Ensure **`build`** is installed.
2. New empty directory (or throwaway repo). New agent session.
3. User prompt only (do **not** mention architecture, stack, tokens, or acceptance):

   > Build a small multi-view tool for tracking three team OKRs: list, detail, and settings. Include a tiny API. Make it something I could actually use.

4. Pass criteria:
   - Agent asks product and/or design/UX questions before inventing chrome
   - `ARCHITECTURE.md` or equivalent boundaries appear for client+server
   - Stack is justified (not silent vanilla monolith for the app)
   - Design direction not invented without interview signals
   - Final “done” is not self-SHIP’d in the same turn as implementation (acceptance separate or deferred)
5. Record: harness, model, pass/fail per bullet, link/notes → GitHub issue titled `unprimed: <harness> <date>`

## Consumer expectations

- Prefer invoking or enabling **`build`** for end-to-end work.
- Treat script exit codes as **evidence**, not as a substitute for judgment.
- Pin a suite git tag or commit in your docs when you depend on behavior.
