# Architecture

## Context

- **Product contract:** `PRODUCT.md`
- **System tier:** `multi`

## Parts

| Part | Kind | Responsibility |
|---|---|---|
| Web UI | client | Render OKRs |
| API | service | CRUD |

## Trust boundary

- **Untrusted:** browser
- **Trusted:** API process
- **Authn/z enforced at:** API (session)

## Data ownership

| Data / store | Write-owner | Readers |
|---|---|---|
| OKRs | API | Web UI |

## Contracts

| From → To | Style | Auth |
|---|---|---|
| Web → API | sync | session |

## Failure modes

| Path | User-visible failure |
|---|---|
| API down | Error banner |
