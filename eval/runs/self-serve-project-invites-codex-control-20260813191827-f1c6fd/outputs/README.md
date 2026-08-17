# Project invitations

## Product contract

An authenticated project admin creates an invitation with `POST /api/projects/:projectId/invites`.

Request headers:

- `Authorization: Bearer <account-name>` — the account name is the inviter.
- `Idempotency-Key: <client-generated-key>` — required; retrying the same key for the same inviter and project returns the original invitation.

JSON body: `{ "email": "person@example.com", "role": "viewer" | "editor" }`.

Success is `201` with `{ projectId, email, role, inviter, inviteUrl }`. The service generates the link and does not deliver email in this version. Invalid input returns `422`; missing authentication returns `401`; a non-admin returns `403`.

## Live trust boundary

Everything supplied by the browser is untrusted: account name, project ID, email, role, headers, and JSON. The server authenticates only the Bearer account name and checks it against the configured project-admin map; it does not trust a client-supplied inviter or admin flag. The server validates and normalizes email, allowlists the role, generates the invite token, and owns idempotency state. The current store is in memory and is intended for this first version; restarting the process loses invitations. Configure `createServer({ projectAdmins, baseUrl })` for deployment.

Run `npm test`.
