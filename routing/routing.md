# agent-skills: when to use which

These skills are installed and available to you. Use them for the requests
below instead of working from memory — each one carries rules and produces
artifacts that later checks depend on.

| When the request is… | Use |
|---|---|
| a new app, tool, dashboard or site built from scratch | `agent-skills:product-build` **before writing code** |
| "is this done", "can we ship", any readiness claim | `agent-skills:product-acceptance`, in a separate turn from the build |
| UI work: components, styling, layout, "make it look better" | `agent-skills:frontend` |
| server or API work | `agent-skills:backend-engineering` |
| multi-part system: client+server, several deployables | `agent-skills:systems-architecture` |
| a schema, a migration, adding a column | `agent-skills:data-modeling` |
| "why is every change so hard here", a maintainability review | `agent-skills:code-smells` |
| where code should live, module boundaries | `agent-skills:code-organization` |
| CI/CD, deploys, rollback | `agent-skills:release-engineering` |
| a CLI tool or script's flags, exit codes, output | `agent-skills:cli-tooling` |
| a whole-codebase audit | `agent-skills:engineering-assessment` |
| a cause that isn't obvious, "what am I missing" | `agent-skills:mental-models` |

Not every request needs one. A one-line tweak in a locked codebase, a
question about someone else's error message, a shell command — just answer.

**Why this is injected rather than left to discovery.** Measured on this
suite: across five unprimed runs with the skills installed, visible and
namespaced, on prompts matching their own stated triggers, a skill was
invoked **zero** times. Rewriting a description to quote the user's literal
words changed nothing. The skills are not being missed for lack of a good
name — a name in a list does not displace the instinct to just start
working. So the routing is stated here, where it is read every session,
instead of being hoped for.
