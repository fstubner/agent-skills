# Product

> Provenance: stated-by-human

## Purpose

Let an authenticated project admin create a shareable invitation for a person with viewer or editor access.

## Users

- **Primary:** Authenticated project admins.
- **Context:** They enter an invitee email and choose a role; the service returns a link to share manually.

## Success

- A project admin can submit an email and role and receive a shareable invite link.
- Retrying with the same Idempotency-Key returns the original invite.

## MVP

- Bearer account-name authentication.
- Server-side validation of email, role, authentication, and idempotency key.
- Viewer and editor invitations with generated shareable links.
- Accessible browser form with loading, empty, error, and success states.

## Anti-goals

- No email delivery.
- No invite acceptance, expiration, revocation, or persistent database in this version.

## Constraints

- Keep the existing Node HTTP server and browser HTML/CSS/JavaScript stack.
- Client data is untrusted; the authenticated account is the inviter.

## Acceptance

- [ ] Primary job completable on the happy path
- [ ] Empty and error states for the primary view
