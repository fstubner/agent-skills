# Boundaries — evergreen properties

These are **properties** of a sound system. Tool names are examples only; replace with whatever the project already uses.

## 1. Name the parts

Every multi-part system states:

| Part | Questions |
|---|---|
| **Clients** | Who runs untrusted code? (browser, mobile, CLI) |
| **Application services** | What accepts requests and enforces rules? |
| **Data stores** | What persists state? Who may write? |
| **Async workers** (if any) | What runs off the request path? |
| **Third parties** | What is outside your process and on the critical path? |

If a part is not needed for the MVP, omit it and say so under anti-goals / complexity.

## 2. Trust boundary

State explicitly:

- What the **untrusted client** may know and call
- What must **never** leave the trusted side (secrets, privileged credentials, raw admin powers)
- Where **authentication** and **authorization** are enforced (not “in the UI”)

Property: *privileged capability is enforced on the trusted side of the boundary.*

## 3. Data ownership

For each important entity or store:

- **Write-owner** (one)
- **Readers**
- If two writers exist → **sync rule** or it is a defect

Property: *no silent dual source of truth.*

## 4. Contracts between parts

For each client→service or service→service edge:

- Sync request/response vs async (queue/event) — choose one primary style per edge
- Authn/z expectation
- Invalid input / error shape (enough for clients to act)
- Idempotency for unsafe retries on writes (when retries exist)

Property: *edges are described before new ones are invented in code.*

## 5. Failure modes

For each external dependency and each write path, name at least:

- What failure looks like to the user
- Retry or not (and who retries)
- What must not be double-applied

Property: *failure is designed, not discovered only in production.*

## 6. Complexity budget

Default shape for an MVP product app:

- One trusted application process (or platform equivalent)
- One primary data store
- One primary client surface

Distribute (extra services, meshes, multi-region) only when a **named constraint** in PRODUCT.md requires it. Fashion is not a constraint.

Property: *distribution is justified, not default.*

## 7. Change rule

Changing trust boundaries, write-owners, or adding a critical third party requires updating `ARCHITECTURE.md` in the same change set as the code.
