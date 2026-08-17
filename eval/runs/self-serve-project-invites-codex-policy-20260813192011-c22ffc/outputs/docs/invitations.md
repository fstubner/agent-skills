# Self-serve project invitations v1

## Product contract

`POST /api/projects/{projectId}/invitations` creates an invitation. The request must contain JSON `{ "email": "person@example.com", "role": "viewer" | "editor" }`, an `Authorization: Bearer <account-name>` header, and a unique `Idempotency-Key` header. The authenticated account is the inviter; callers cannot choose `invitedBy`.

On success the service returns `201` with `id`, `projectId`, normalized `email`, `role`, `invitedBy`, and a shareable `inviteUrl`. This release generates a link only; it does not send email.

Repeating the same key for the same authenticated account and request returns the original invite. Reusing a key with different data returns `409`. Missing/invalid auth is `401`, a non-admin is `403`, and invalid input is `400`.

## Live trust boundary

Everything in the HTTP request is untrusted: path, headers, body, and browser JavaScript. The server validates the bearer account-name syntax, JSON shape, email, role, and idempotency key. Authorization is performed server-side against the project-admin registry; the bearer account is the only source of inviter identity. Invite records and idempotency records are currently in memory and are lost on restart, so durable storage and token redemption are deliberately out of scope for v1.

The included browser form is a convenience client, not a security boundary. It sends the account name as a bearer credential and must be placed behind the real authentication mechanism before production use.
