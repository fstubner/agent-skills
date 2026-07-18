# Charter: systems-architecture

## Failure mode countered

LLM implements features without system shape: no trust boundaries, invented integrations, secrets in the client, ops ignored, or distributed complexity for an MVP.

## Owns

- System context from PRODUCT.md + constraints
- Component / boundary map (clients, APIs, data, workers, third parties)
- Trust boundaries and tenancy at the *system* level
- Sync vs async contracts between parts
- Failure modes and observability *properties*
- `ARCHITECTURE.md` (or `docs/architecture.md`)
- Deterministic architecture smell / section gates

## Does not own

- Framework UI choice (frontend-engineering)
- Handler/ORM implementation detail (backend-engineering)
- Visual craft (frontend-design)
- Final product SHIP (product-acceptance)
- Product MVP cut (product-management) — consumes PRODUCT.md

## Evergreen invariants (properties)

1. **Boundaries before code** for multi-part systems (client + server, or ≥2 deployable parts).
2. **Trust boundary explicit** — what the browser/untrusted client must never hold.
3. **One write-owner per data** — avoid dual sources of truth without a stated sync rule.
4. **Failure modes named** for each external dependency and write path.
5. **Complexity matches MVP** — no distributed topology by default; justify any split with a PRODUCT constraint.
6. **Existing architecture wins** — extend documented shape; don't invent a parallel system.

**Not evergreen (forbidden as skill identity):** required cloud vendors, orchestrators, “always serverless/K8s,” or pinned SaaS. Those may appear only as optional dated examples in `recipes/`.

## Skill path

`~/.cursor/skills/systems-architecture/`
