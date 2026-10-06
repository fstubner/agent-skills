# ADR 1: Keep key order instead of sorting keys

- **Date:** 2026-01-10
- **Status:** Accepted

## Context

Teams review JSON changes in pull requests, and sorted keys turn a one-line
change into a rewritten file.

## Decision

tidy keeps the key order a file already has.

## Consequences

Diffs stay small. Two files with the same keys in different orders stay
different, which some users will find surprising.

## Alternatives rejected

- Sorting keys alphabetically, because it rewrites whole files.
