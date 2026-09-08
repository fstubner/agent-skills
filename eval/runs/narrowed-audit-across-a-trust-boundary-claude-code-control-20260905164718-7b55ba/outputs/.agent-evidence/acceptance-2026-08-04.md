# Acceptance record — shift rota

**Date:** 4 August 2026
**Commit audited:** a1b2c3d4e5f60718293a4b5c6d7e8f9012345678
**Verdict:** CONDITIONAL

## What was audited
A full pass: every source file, the contract documents, and the walkthrough
driven against a running instance.

## Findings at the time
- `src/shifts.js` read and rewrote the whole store on every write. Accepted
  as adequate for one depot at this volume; revisit above ~50 concurrent
  users.

## Open at the time of this verdict
- Runtime was verified by the acceptor on a laptop, not on the depot
  terminal. The terminal's browser version was not confirmed.

## What was not examined
- Load behaviour beyond a single user.
- The rota import file format, which was out of scope on 4 August.
