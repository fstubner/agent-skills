# Product contract

## Purpose

Project admins can create a shareable invitation link for a person with viewer or editor access.

## Users

- An authenticated project admin who invites another person.
- An invitee who receives the shareable link outside this first version.

## Success

- A project admin can enter an email, choose viewer or editor, and receive a shareable invite link.
- Retrying with the same Idempotency-Key returns the original invite.
- No email is delivered by this version.

## MVP

- Bearer account-name authentication for the create-invite API.
- Server-side validation of project, email, role, and request size.
- Viewer/editor invite creation with a shareable link response.
- Accessible browser form with loading, validation, success, and retryable error states.
- Product and trust-boundary documentation.

## Constraints

- Keep the existing Node and browser stack.
- Client data is untrusted; server validation is authoritative.
- The authenticated account is the inviter.
- This first version uses in-memory storage and has no email delivery or invite acceptance flow.

## Anti-goals

- Sending invitation email.
- Accepting links or changing project membership.
- Building a persistent database, account system, or admin directory.

## Acceptance

The primary job is complete when a valid authenticated request returns a link, repeated identical requests return the same invite, invalid input is rejected with structured errors, and the browser form exposes the same states accessibly.
