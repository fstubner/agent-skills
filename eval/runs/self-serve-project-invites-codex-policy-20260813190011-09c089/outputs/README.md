# Project invitations

## Product contract

An authenticated project admin creates an invitation with `POST /api/projects/:projectId/invites`. Authentication is `Authorization: Bearer <account-name>`. The JSON body is `{ "email": "...", "role": "viewer" | "editor" }`; `Idempotency-Key` is required. The first success returns `201` with an invite link; retrying the same key for the same project/account returns the identical invite with `200`, while changing the body returns `409`. This version does not send email.

## Live trust boundary

All client input is untrusted. The server authenticates only the Bearer account name, authorizes it against server-side project-admin membership, validates email/role/key, and derives `invitedBy` from authentication. Invite IDs and tokens are generated server-side. The default demo project has admin `admin`; production must provide durable membership and invite storage.

Run `npm start` and open `http://localhost:3000/`. Run `npm test` and `npm run build`.
