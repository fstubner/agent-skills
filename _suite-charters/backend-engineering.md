# Charter: backend-engineering

## Failure mode countered

Happy-path APIs, weak auth/validation, invented schema, no tenancy or observability.

## Owns

- Data model and API contracts before code
- Auth / tenancy / authorization as first-class
- Invalid input and failure modes
- Idempotency and mutation safety where relevant
- Observability properties (structured errors, request identity)

## Does not own

- System boundary map (**systems-architecture**)
- UI (frontend-*)
- Product MVP cut (product-management)
- Final SHIP (product-acceptance)

## Skill path

`backend-engineering/` in [fstubner/agent-skills](https://github.com/fstubner/agent-skills)
