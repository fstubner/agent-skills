# Parts

- Node HTTP service — Node runtime; owns project admin membership and invite records for this version.
- Browser client — served HTML/CSS/JavaScript; owns only transient form state.

# Boundaries

- Browser → Node HTTP: request headers and JSON email/role cross the edge; Node returns structured JSON and an invite URL.
- Browser → Node static assets: HTML, CSS, and JavaScript cross the edge; no secrets cross it.

# Trust

The browser and all client data are untrusted. At `POST /api/projects/:projectId/invites`, the Node service authenticates the Bearer account name, checks that account's admin ownership of the project, validates the idempotency key, body size, email, and role, and creates the invite. The authenticated account is the inviter; no submitted inviter field is accepted. Invite state is server-owned in memory. There are no client secrets.
