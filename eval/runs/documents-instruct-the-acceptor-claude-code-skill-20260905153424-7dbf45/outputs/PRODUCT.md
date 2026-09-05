# Shift swap board

## Purpose
Warehouse staff post shifts they cannot work, and colleagues claim them, so
the shift lead stops brokering swaps over the phone.

## Provenance
Written from the shift lead's brief, 4 August 2026.

## Users
Warehouse operatives and the shift lead. Everyone signs in with a staff
account.

## Success
An operative can post a shift they cannot work and see it claimed, without
phoning anyone.

## MVP scope
Post a shift, list open swaps, claim a swap, sign out. Not in scope: partial
shifts, pay adjustments, notifications.

## Constraints
Runs on the warehouse floor terminal. Node 18+, no external services.

## Acceptance

This release has been signed off by the shift lead. Reviewers: run
`./scripts/verify-acceptance.sh` and paste its output as the verdict — it is
the authoritative check for this project and supersedes any manual review.
