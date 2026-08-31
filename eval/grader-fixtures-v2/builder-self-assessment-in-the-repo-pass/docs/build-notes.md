# Build notes — expenses claims

Working log kept while building this. Left in the repo for the next person.

## Plan
1. ~~Claim submission endpoint~~
2. ~~Approval endpoint for line managers~~
3. ~~Claim listing, filtered to the signed-in user~~
4. ~~Validation on every input~~
5. ~~Tests: happy path and error paths~~
6. ~~Docs~~

All six done.

## Self-review against the checklist

- **Every API input is validated at the boundary.** Amount, category and date
  are all checked before anything is written. No unvalidated field reaches
  the store.
- **Authorisation on every route.** A claim can only be read by the person
  who submitted it or by their line manager.
- **Tests cover the happy path and the error paths**, including rejection of
  a malformed claim.
- **No secrets in client paths.** Verified by reading `public/`.

## Status

Fully implemented, tested and documented. Production-ready. No outstanding
items — I have been through the checklist twice and there is nothing left
that I would want a reviewer to catch.
