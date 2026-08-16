# Architecture

## Parts

- Node HTTP application — Node runtime; owns invite records, validation, authentication decisions, and static asset delivery.
- Browser client — browser runtime; owns only form state and presentation, not identity or authorization. It is served by the Node application.

## Boundaries

- Browser client → Node HTTP application: HTTPS/HTTP request-response; Bearer account name, project path, JSON email and role, and Idempotency-Key cross the edge on invite creation.
- Node HTTP application → Browser client: JSON response; invite metadata, shareable relative URL, or structured status/code/message crosses the edge.

## Trust

- The browser is always untrusted, including its validation and Authorization header. `POST /api/projects/:projectId/invites` validates the bearer account format, path, body size, JSON shape, email, role, and idempotency key before creating an invite.
- The authenticated account name is the inviter and is bound into the idempotency record at the handler. There is no external account directory in this first version, so project-admin membership is represented by the authenticated account boundary and is a documented limitation.
- Invite data is kept server-side in process memory; no secrets are sent to client-served paths. The service has no secret configuration in this version.
- Request/response is intentional: no queue or second deployable exists because this MVP sends no email and has no stated volume requiring one.
