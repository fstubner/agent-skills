# Charter: backend-engineering

## Failure mode countered

Happy-path APIs, weak auth/validation, invented schema, no tenancy or observability.

## Owns

- Data model and API contracts before code
- Auth / tenancy / authorization as first-class
- Invalid input and failure modes
- Idempotency and mutation safety where relevant
- Observability properties (structured errors, request identity)
- Deterministic contract checks when scripts exist

## Does not own

- System boundary map / trust topology (**systems-architecture** — read `ARCHITECTURE.md` first)
- UI (frontend-*)
- Product MVP cut (product-management)
- Final SHIP (product-acceptance)

Implement *inside* the documented architecture. If `ARCHITECTURE.md` is missing on a multi-part system, stop and invoke systems-architecture.

## Evergreen invariants (properties)

1. Contract before implementation (OpenAPI / typed handlers / equivalent).
2. Every write path states authz and invalid-input behavior.
3. No silent data loss; errors are actionable.
4. Secrets never in client bundles.
5. Existing server stack wins — no dual ORMs/frameworks.

## Promotion status

**Charter only.** Implement `~/.cursor/skills/backend-engineering/` when the next server-backed app is built.
