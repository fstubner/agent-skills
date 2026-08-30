# Architecture

## Parts

- Node invitation service: Node HTTP process; owns invite records for its process lifetime.
- Browser client: static HTML/CSS/JavaScript; owns only transient form state.

## Boundaries

- Browser → Node service over HTTP request/response; JSON email, role, project path, Bearer account name, and Idempotency-Key cross the edge.
- Node service → Browser over HTTP response; structured JSON invite result or error crosses the edge.

## Trust

- Browser is untrusted. The Node service validates authorization, path, body size, JSON shape, email, role, and idempotency key at POST /api/projects/:projectId/invites.
- The Bearer account name is the authenticated inviter; this MVP assumes the authenticated caller has project-admin permission, and no client-supplied inviter is accepted.
- No secrets are used or sent to the browser. Invite tokens are generated server-side with crypto.randomBytes.

## Contracts

- POST /api/projects/:projectId/invites with `Authorization: Bearer <account>`, `Idempotency-Key: <key>`, and `{ "email": string, "role": "viewer"|"editor" }` returns 201 and `{ projectId, email, role, invitedBy, inviteLink }`.
- The same account, project, and key returns the original result with 200. Failures return `{ code, message }`.
