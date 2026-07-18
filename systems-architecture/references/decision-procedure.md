# Architecture decision procedure

Evergreen process. Do not replace this with a vendor checklist.

## Step 0 — Load product contract

Read `PRODUCT.md` or `product-brief.md`.

If missing on a multi-part system: stop; product contract first (product-acceptance template / product-management charter). Architecture without purpose invents scope.

## Step 1 — Classify system tier

From the repo and brief (see `profile-architecture.js`):

| Tier | Meaning |
|---|---|
| `single` | One deployable surface; no trusted server and no core third-party path |
| `multi` | Client + trusted service, or core external API on the happy path |
| `distributed` | Multiple trusted deployables or async backbone as primary design |

Existing project signals beat vibes.

## Step 2 — Infer → propose → confirm

1. Infer parts, trust boundary, and data write-owners from code + brief.
2. Propose **one** architecture sketch (short): parts, trust line, primary store, critical third parties.
3. Confirm with the user when:
   - Adding a new critical third party
   - Splitting into more than one trusted service
   - Changing where secrets or authz live
4. Write `ARCHITECTURE.md`.

Do not present five equivalent topologies. Prefer the simplest that meets PRODUCT constraints.

## Step 3 — Ask only when forks are real

Ask (one round) if unclear:

1. Must data leave this environment? (compliance / residency)
2. Is offline or eventual sync required?
3. Multi-tenant isolation: none / soft / hard?
4. Any must-use platform constraint already decided?

Do not ask fashion questions (“Kubernetes or serverless?”) unless a constraint forces the fork.

## Step 4 — Gate before deep build

On `multi` / `distributed`:

```
node "<SKILL_ROOT>/scripts/check-architecture.js" --root . --strict
```

BLOCK means stop claiming system-ready; fix the doc or the contradiction in code smells.

## Step 5 — Hand off

Implementation follows the doc. Contradictions update the doc first (or in the same change), never “code wins silently.”
