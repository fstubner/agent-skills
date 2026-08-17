# Architecture

## Parts

The browser serves the form. The Node API stores invites in memory for this fixture.

## Boundaries

The browser client is untrusted. It crosses the HTTP boundary with an email, role, Bearer account, and Idempotency-Key.

## Trust

The server authenticates the Bearer account, owns inviter identity, and validates email and role. Idempotency keys are scoped to the authenticated account.
