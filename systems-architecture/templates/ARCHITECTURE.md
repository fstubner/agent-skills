# Architecture

## Context

<!-- Link to PRODUCT.md purpose + constraints that shape this system. -->

- **Product contract:** `PRODUCT.md` | `product-brief.md`
- **System tier:** `single` | `multi` | `distributed`
- **Complexity stance:** simplest that meets constraints (state why if not one client + one trusted service + one store)

## Parts

| Part | Kind | Responsibility |
|---|---|---|
| | client / service / store / worker / third-party | |

## Trust boundary

- **Untrusted:** 
- **Trusted:** 
- **Must never reach untrusted clients:** 
- **Authn/z enforced at:** 

## Data ownership

| Data / store | Write-owner | Readers | Sync rule (if needed) |
|---|---|---|---|
| | | | |

## Contracts (edges)

| From → To | Style (sync/async) | Auth | Notes |
|---|---|---|---|
| | | | |

## Failure modes

| Dependency or write path | User-visible failure | Retry? | Double-apply risk |
|---|---|---|---|
| | | | |

## Observability (properties)

- Request/correlation identity: 
- Structured errors to clients: 
- What is logged vs forbidden to log: 

## Anti-goals (architecture)

<!-- e.g. no extra services, no second database, no client-held privileged secrets -->

- 

## Decision log (short)

| Date | Decision | Why |
|---|---|---|
| | | |
