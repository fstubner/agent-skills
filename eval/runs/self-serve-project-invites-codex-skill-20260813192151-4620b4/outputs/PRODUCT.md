# Product contract

## Purpose

Let a project admin create a shareable link that grants a named person viewer or editor access to a project.

## Users

- Authenticated project admins invite people.
- Invitees use the shared link in a later product flow (not included here).

## Success

- A project admin can submit an email and permission and receive a shareable invite link.
- Repeating the request with the same Idempotency-Key returns the original invite.
- Invalid or unauthorized requests receive a structured error without internal details.

## MVP

- Bearer account-name authentication for the invite-creation API.
- Server-side project-admin authorization, email and role validation.
- Viewer/editor invite records and shareable links held by the service.
- Accessible browser form for creating and displaying a link.
- Product and trust-boundary documentation.

## Constraints

- Keep the existing Node.js standard-library server and browser HTML/CSS/JavaScript stack.
- Client data is untrusted; the authenticated account is the inviter.
- This version does not send email.
- Invite persistence is in-memory for this first version.

## Anti-goals

- Email delivery, invitation acceptance, expiry, revocation, or project membership UI.
- Password, session, or account-management flows.

## Acceptance

The critical path is an authenticated admin creating a viewer or editor link, with rejected garbage input and deterministic retry behavior verified against the running server.
