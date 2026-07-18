# Architecture

## Context

Multi-part demo with conflicting ORMs.

## Parts

| Part | Kind | Responsibility |
|---|---|---|
| API | service | CRUD |
| UI | client | Render |

## Trust boundary

- Untrusted: browser
- Trusted: API

## Data ownership

| Data | Write-owner | Readers |
|---|---|---|
| items | API | UI |

## Contracts

| From → To | Style | Auth |
|---|---|---|
| UI → API | sync | session |

## Failure modes

| Path | Failure |
|---|---|
| API down | error banner |
