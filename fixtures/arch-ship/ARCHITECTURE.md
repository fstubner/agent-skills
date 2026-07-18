# Architecture

## Context

- **Product contract:** `PRODUCT.md`
- **System tier:** `multi`
- **Complexity stance:** one client + one trusted service + one store

## Parts

| Part | Kind | Responsibility |
|---|---|---|
| Web UI | client | Render OKRs |
| API | service | CRUD |
| JSON file | store | Persistence |

## Trust boundary

- **Untrusted:** browser
- **Trusted:** API process
- **Must never reach untrusted clients:** DB credentials, admin tokens
- **Authn/z enforced at:** API

## Data ownership

| Data / store | Write-owner | Readers | Sync rule (if needed) |
|---|---|---|---|
| OKRs | API | Web UI | n/a |

## Contracts (edges)

| From → To | Style (sync/async) | Auth | Notes |
|---|---|---|---|
| Web → API | sync | session | JSON |

## Failure modes

| Dependency or write path | User-visible failure | Retry? | Double-apply risk |
|---|---|---|---|
| API down | Error banner | yes | low |

## Anti-goals (architecture)

- No second database
