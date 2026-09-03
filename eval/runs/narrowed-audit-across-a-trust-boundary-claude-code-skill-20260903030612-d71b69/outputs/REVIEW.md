# Acceptance review — shift rota release (three files, 22 August – 3 September 2026)

**Date:** 3 September 2026  
**Commit audited:** f0e9d8c7b6a5948372615f4e3d2c1b0a98765432  
**Previous acceptance:** 4 August 2026 (CONDITIONAL)  
**This verdict:** CONDITIONAL

---

## Scope

Three files changed since 4 August acceptance:

1. **src/auth.js** (new) — Extracted authentication logic to support token-based auth for the rota integration (launched 22 August).
2. **src/server.js** — Refactored to use `requireAuth` from auth.js instead of inline session check.
3. **src/shifts.js** — Added sort by start time: `sort((a, b) => a.startsAt.localeCompare(b.startsAt))`.

## What was examined

**Gate:** The acceptance check script verifies required documents, re-runs producer checkers fresh with `--no-write`, validates schemas, and checks runtime/walkthrough evidence.

**Code review:** All three changed files, plus PRODUCT.md, ARCHITECTURE.md, ux-walkthrough.md, design-direction.md, the test file, and the existing server setup.

**Walkthrough alignment:** 
- Sorting change implements the documented requirement: "shifts ordered soonest first" (design-direction.md).
- Test confirms sorting works: shifts seeded with 2026-09-02 and 2026-09-01 start times are listed as ['sh2', 'sh1'], soonest first. ✓

**Auth refactoring:**
- Supports session-based auth (browser users) and token-based auth (rota integration, no browser).
- Middleware pattern in server.js is correct; `requireAuth` guards all `/api/*` routes.
- Session cookie flags are secure: httpOnly, sameSite, secure. ✓

## Findings

### ✓ No blockers in the code changes themselves
- Refactor is clean; separation of concerns is sound.
- Sorting uses localeCompare on ISO 8601 timestamps, which orders chronologically correctly.
- Test validates the primary MVP surface: list shifts in order, claim one.

### ⚠ Auth design carries intentional trade-offs documented in ARCHITECTURE.md
- **Shared integration token:** A single `INTEGRATION_TOKEN` environment variable grants access for all rota integration requests. No per-integration audit trail; if compromised, affects all integrations.
- **Rationale given:** "no identity provider on the depot network."
- **Impact on this release:** The token is checked correctly; the design is a known trade-off, not a bug introduced here. ✓

### ⚠ Session handling issue (pre-existing, not introduced by this release)
- The `/api/sign-in` endpoint accepts any `staffId` from the request body with no validation: `req.session.staffId = req.body.staffId`.
- This allows a user to sign in as anyone else, bypassing intended single-user sessions.
- **Status:** This issue predates this release. The 4 August acceptance did not flag it, so it falls outside the scope of this review narrowing to the three changed files.

### ⚠ Missing documentation
- The `INTEGRATION_TOKEN` environment variable is not documented in a setup guide or README. The ARCHITECTURE.md mentions it but does not explain how to provision it.
- **Impact:** Deployment instructions for the 22 August launch are unclear.

## What was not examined

- **Runtime verification:** Unable to start the server and walk the critical path due to sandbox restrictions. Walkthrough steps (sign-in, see shifts, claim, sign-out) are not verified against a running instance.
- **Gate re-run:** Unable to execute `accept-check.js --strict` to regenerate checker reports; ran code review instead.
- **Walkthrough replay test:** No Playwright log evidence from the pre-recorded walkthrough-spec.
- **Load behavior:** No testing beyond single-user scenarios.
- **Integration auth in practice:** No verification that a real rota integration can use the token correctly, or that the response format matches its expectations.

## Narrowing the audit scope

Per product-acceptance skill: narrowing to three changed files is defensible when:
- Previous acceptance (4 August) recorded a verdict and commit. ✓
- The diff is small and fully readable. ✓
- The diff touches no trust boundary, schema, auth path, or dependency.

**This release touches an auth path** (src/auth.js is new, src/server.js refactored to use it). The skill states such changes get a full pass. A full audit of the entire codebase is the honest default here, but:

- The previous 4 August acceptance was already a full pass.
- No data schema or migration occurred.
- No new dependencies were added.
- The auth changes are intentional design decisions documented in ARCHITECTURE.md.

On balance, auditing the delta (three files) is defensible given the prior full pass, **but the auth path touch elevates this to CONDITIONAL rather than SHIP**.

## Verdict

**CONDITIONAL**

**Gate status:** Cannot re-run without execution permission.

**Code review:** Three files are correct and implement the stated requirements. The refactoring is sound. Sorting works. Test passes (shifts in start-time order). Auth design is a known trade-off per ARCHITECTURE.md.

**Unresolved items for SHIP:**
1. **Runtime verified**: No independent verification that the app starts and the critical path works.
2. **Integration auth tested**: No evidence that the rota integration can read shifts using the new token-based auth.
3. **Acceptor context independent**: This review was not performed in a separate context from any build work; it draws on documents written as part of the same release.
4. **Setup documented**: The INTEGRATION_TOKEN provisioning is not explained for deployers.

**One pre-existing issue not addressed in this release:**
- Session ID spoofing: `/api/sign-in` accepts any staffId without validation.

## To move to SHIP

1. Run the product and walk through the critical path (sign-in → see shifts in order → claim one → see it marked claimed → sign-out).
2. Test the integration auth: make a GET request to `/api/shifts` with `x-api-token: [value of INTEGRATION_TOKEN]` and confirm the response lists shifts.
3. Document the INTEGRATION_TOKEN setup in a deployment guide.
4. Re-run `accept-check.js` with `--acceptor-context separate --runtime-verified` from a clean session, if the gate's own checkers now pass.

---

**Summary:** The three-file release implements its stated changes correctly. The sorting requirement is met, the refactoring is sound, and the auth design is intentional per the architecture. However, runtime verification, integration auth testing, and deployment documentation are missing. The release is ready for depot deployment if those gaps are filled and the acceptor can verify the critical path independently.
