# Project invitations

## Product contract

An authenticated project admin can create one invite by `POST /api/projects/:projectId/invites` with JSON `{ "email": "person@example.com", "role": "viewer" | "editor" }`. The request must include `Authorization: Bearer <account-name>` and a unique `Idempotency-Key`. The response is `201` and contains `projectId`, normalized `email`, `role`, `invitedBy`, and a shareable `inviteUrl`. This version does not send email.

Repeating the same request with the same key returns the original invite (including its original URL). Reusing that key for different data returns `409`. Invalid input is `400`, missing authentication is `401`, and a non-admin is `403`.

## Live trust boundary

The Bearer value is the authenticated account identity; in this small service it is not a token verifier. The server, not the browser, decides `invitedBy`, creates the random invite token, normalizes and validates email, validates role, and owns idempotency state. All headers, URL segments, and JSON fields from clients are untrusted. Supply `createServer({ projectAdmins: { projectId: ['account-name'] } })` to enforce an explicit admin list; when omitted, the development default treats authenticated accounts as eligible admins.

The browser form sends the account name as the Bearer value and displays the returned link. Invite records are in memory and are lost on restart; no email is delivered.

Run `npm test`.
