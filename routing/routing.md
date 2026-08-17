# agent-skills: when to use which

These skills are installed and available to you. Use them for the requests
below instead of working from memory — each one carries rules and produces
artifacts that later checks depend on.

## The five that carry the work

Ranked by twelve days of recorded usage across eight real projects, most
first. If you read no further, read these.

| When the request is… | Use |
|---|---|
| a whole-codebase audit, "how bad is this", a health check | `agent-skills:engineering-assessment` |
| any prose that will be read by a human — docs, a README, a post | `agent-skills:ai-prose-slop` |
| "is this done", "can we ship", any readiness claim | `agent-skills:product-acceptance`, in a separate turn from the build |
| UI work: components, styling, layout, "make it look better" | `agent-skills:frontend` |
| CI/CD, deploys, rollback, "does this project even run" | `agent-skills:release-engineering` |

## The rest, when their trigger is plainly the request

| When the request is… | Use |
|---|---|
| creative work: a new app, a new feature, a component, a behaviour change | `agent-skills:product-build` **before writing code** — it agrees a design first, then dispatches |
| server or API work | `agent-skills:backend-engineering` |
| multi-part system: client+server, several deployables | `agent-skills:systems-architecture` |
| a schema, a migration, adding a column | `agent-skills:data-modeling` |
| "why is every change so hard here", a maintainability review | `agent-skills:code-smells` |
| where code should live, module boundaries | `agent-skills:code-organization` |
| a CLI tool or script's flags, exit codes, output | `agent-skills:cli-tooling` |
| a cause that isn't obvious, "what am I missing" | `agent-skills:mental-models` |

Not every request needs one. A one-line tweak in a locked codebase, a
question about someone else's error message, a shell command — just answer.

**Why two tiers.** Seventeen skills competing in one flat list is seventeen
things to weigh on every request, and a list that long is skimmed rather
than read. The split is empirical, not a ranking of quality: the top five
are the ones actually reached for in real work, and a skill moves between
tiers when the usage does.

**If another plugin's brainstorming or planning skill also claims the
request**, use `product-build`. It covers the same ground — design agreed
before code — and then dispatches to the skills that write the artifacts
the acceptance gate reads. Running the other one instead leaves those
unwritten, and acceptance has nothing to check.

**Why this is injected rather than left to discovery.** Measured on this
suite: across five unprimed runs with the skills installed, visible and
namespaced, on prompts matching their own stated triggers, a skill was
invoked **zero** times. Rewriting a description to quote the user's literal
words changed nothing. A name in a list does not displace the instinct to
just start working, so the routing is stated here, where it is read every
session, instead of being hoped for.

**How well that works: partially, and not on real work.** On three short
prompts this table moved a model from invoking nothing to invoking
something. On a full build — an app with sign-in, a schema migration and a
CLI — it produced **zero** invocations and an output directory identical to
the control's. Text asking a model to route is the weakest of this suite's
three mechanisms; the checkers, which ask nothing, are the strongest. If
you want the rules applied rather than available, run the checkers.
