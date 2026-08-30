> Provenance: stated-by-human

# Purpose

Let an authenticated project admin create a shareable invitation link for a person with viewer or editor access.

# Users

- Project admins who invite collaborators.
- Invitees who receive a link (email delivery is outside this version).

# Success

- A project admin can enter an email, choose viewer or editor, and receive a shareable invite link.
- Repeating a request with the same Idempotency-Key returns the original invite.

# MVP

- Bearer account-name authentication.
- Admin authorization for a project.
- Server validation of email, role, body size, and idempotency key.
- Accessible browser form with clear success and error states.

# Constraints

- Keep the existing Node and browser stack.
- Client data is untrusted; the authenticated account is the inviter.
- No email delivery in this version.

# Anti-goals

- Sending email, accepting invite links, membership lifecycle management, and persistent storage.

# Acceptance

The API and browser form complete the primary invitation flow and retries are stable.
