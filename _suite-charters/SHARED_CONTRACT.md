# Shared contract — skill suite

Countermeasures for known LLM failure modes. All suite skills share this vocabulary.

## PRODUCT.md (project root)

Strategic product contract. Answers who / what / why — not how it looks.

Required sections (h2):

| Section | Content |
|---|---|
| `## Register` | `brand` (marketing/landing) or `product` (app/tool) |
| `## Users` | Primary user, context, secondary if real |
| `## Purpose` | Job to be done in one sentence |
| `## Success` | Observable success metric for the MVP |
| `## MVP` | In-scope capabilities for this ship |
| `## Anti-goals` | Explicitly out of scope / not building |
| `## Constraints` | Hosting, SEO, CMS, must-use stack, offline, etc. |

Optional:

| Section | Content |
|---|---|
| `## Platform` | `web` (default) / `ios` / `android` / `adaptive` |
| `## Acceptance` | Bullet acceptance criteria the acceptor will check |

Aliases accepted by tools: `product-brief.md` may stand in until renamed to `PRODUCT.md`. Prefer `PRODUCT.md` going forward.

## Design / eng / architecture artifacts (not product strategy)

| File | Owner skill | Content |
|---|---|---|
| `design-direction.md` | frontend-design | Five visual decisions |
| `design-tokens.json` | frontend-design | Token contract |
| `stack-decision.md` | frontend-engineering | Chosen stack + rationale + confirm |
| `ARCHITECTURE.md` | systems-architecture | Boundaries, data flow, trust, failure modes |

Aliases: `docs/architecture.md` accepted by tools. Prefer root `ARCHITECTURE.md`.

## Verdicts

Every gate/critique skill reports exactly one of:

| Verdict | Meaning |
|---|---|
| **SHIP** | No blockers; warnings allowed if justified |
| **CONDITIONAL** | No hard blockers; unresolved warnings or soft gaps |
| **BLOCK** | Must fix before claiming done |

## Evidence rules

- Claims need **artifacts**: script JSON, path walkthrough, screenshot, or cited file:line.
- “Looks fine” / builder memory is not evidence.
- Domain skills produce evidence; **product-acceptance** consumes it.

## Builder ≠ acceptor

1. The agent that implements a feature **must not** issue the final product-acceptance SHIP in the same unbroken turn.
2. Final acceptance runs in a **separate turn**, subagent, or explicit user-invoked `/product-acceptance` pass.
3. Design critique (visual) ≠ product acceptance (outcome vs brief).

## Scope tiers

| Tier | Meaning |
|---|---|
| **component** | Isolated UI unit |
| **page** | Single view / landing surface |
| **app** | Multi-view product shell |

App tier requires PRODUCT.md (or product-brief.md) before acceptance can SHIP.

## Stack ownership

- **Existing project wins.** Never introduce a second framework or second icon library.
- **Unknown / greenfield stack** is owned by **frontend-engineering**, not frontend-design.
- Design must not treat `Unknown / vanilla` as a permanent lock for multi-view apps.

## Architecture ownership

- **Multi-part systems** (browser + server, or ≥2 deployables, or external APIs as core path) require `ARCHITECTURE.md` before claiming system-ready.
- **systems-architecture** owns boundaries and trust; **backend-engineering** owns implementing server contracts inside that shape.
- Product-acceptance may **BLOCK** when architecture report is BLOCK on a multi-part app.
