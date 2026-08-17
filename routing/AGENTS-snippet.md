# Portable routing snippet

Paste this into your project's `AGENTS.md` (or `CLAUDE.md`, or
`.cursorrules` — whatever your tool reads every session). It is the same
routing the Claude Code plugin injects via a SessionStart hook, in a form
any tool can use.

Why paste it rather than rely on the skills being discovered: measured on
this suite, five unprimed runs with the skills installed and visible, on
prompts matching their own stated triggers, produced **zero** invocations.
A file your tool reads every session is read every session.

---

```markdown
## Agent skills

The agent-skills suite is installed. For these requests, use the named
skill rather than working from memory — each carries rules and produces
artifacts that later checks depend on:

The five that carry the work, most-used first:

- A whole-codebase audit, "how bad is this" → **engineering-assessment**.
- Prose a human will read — docs, a README, a post → **ai-prose-slop**.
- "Is this done", "can we ship" → **product-acceptance**, in a separate turn
  from the build. The builder never accepts its own work.
- UI: components, styling, layout, "make it look better" → **frontend**.
- CI/CD, deploys, rollback, "does this even run" → **release-engineering**.

The rest, when their trigger is plainly the request:

- Creative work — a new app, a new feature, a component, a behaviour
  change → **product-build** before writing code. It agrees a design
  first, then dispatches. Skip it in one sentence when the user has
  already decided and is asking you to type.
- Server or API work → **backend-engineering**.
- Client+server or several deployables → **systems-architecture**.
- A schema, a migration, adding a column → **data-modeling**.
- "Why is every change so hard here" → **code-smells**.
- Where code should live, module boundaries → **code-organization**.
- A CLI's flags, exit codes, output → **cli-tooling**.
- A cause that isn't obvious, "what am I missing" → **mental-models**.

Not everything needs one. A one-line tweak, a question about an error
message, a shell command — just answer.

If another tool's brainstorming or planning skill also claims the request,
use **product-build**. It covers the same ground and then dispatches to
the skills that write the artifacts the acceptance gate reads.
```

---

## The third mechanism: run the checkers yourself

Routing text still asks the model to comply. The checkers do not. Install
the pre-commit hook and the deterministic layer runs on every commit with
no model decision involved:

```bash
git config core.hooksPath scripts/git-hooks
```

That covers secrets, code smells, import cycles and migration safety on
staged files. It is the only part of this suite with no invocation problem,
because nothing is being asked to choose.
