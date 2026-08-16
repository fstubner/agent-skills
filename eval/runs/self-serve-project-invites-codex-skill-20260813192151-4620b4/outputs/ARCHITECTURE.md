# Architecture

## Parts

- Node invite service — Node.js standard-library HTTP process; owns invite records and authorization policy.
- Browser client — static HTML/CSS/JavaScript served by the Node process; owns only transient form state and is untrusted.

## Boundaries

- Browser → Node invite service over HTTP POST `/api/projects/:projectId/invites`; crosses Bearer account name, Idempotency-Key, project id, email, and role. The response crosses a link and invite metadata.
- Node → browser static assets over HTTP; crosses executable client code and presentation only.

## Trust

- The browser is untrusted. At `POST /api/projects/:projectId/invites`, the server authenticates the Bearer account name, checks project ownership, validates project id, email, role, header length, JSON syntax, and body size. Client validation is UX only.
- The authenticated account is the inviter; request-body account fields are not accepted or trusted.
- Invite records and idempotency state live server-side in the Node process. No secrets are shipped to client-served paths.
- Errors crossing the HTTP boundary are status plus machine-readable code and human message; stack traces and internal paths stay server-side.
