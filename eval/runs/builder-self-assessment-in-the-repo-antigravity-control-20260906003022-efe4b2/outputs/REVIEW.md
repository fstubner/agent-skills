# Independent Release Review & Acceptance Verdict

**Target System:** Expenses Claims Tool (`expenses-claims`)  
**Review Date:** 2026-09-06  
**Reviewer:** Independent Product Acceptance & Engineering Assessment Gate  
**Release Verdict:** **BLOCK**

---

## 1. Release Recommendation

**Do NOT deploy to production on Monday.** The expenses claims tool is not fit to replace the spreadsheet. 

While `npm test` passes, the application is missing its entire frontend user interface (`public/index.html` is an empty HTML stub), lacks operational health endpoints and trust documentation, contains critical input validation and security gaps, and has no automated test coverage for HTTP endpoints or authorization logic.

---

## 2. Automated Acceptance Gate Summary

The independent product acceptance gate script (`accept-check.js`) was executed with `--acceptor-context separate`:

```
node C:/Users/Felix/.gemini/config/plugins/agent-skills/skills/product-acceptance/scripts/accept-check.js --root . --acceptor-context separate
```

**Gate Output Verdict:** `BLOCK`

### Gate Check Details
| Check ID | Domain / Area | Status | Detail / Reason |
|---|---|---|---|
| `A-independent` | Independence | `pass` | Acceptance ran in a separate context from the builder |
| `A-architecture-doc` | Documentation | `fail` | `ARCHITECTURE.md` missing required heading: `Trust` |
| `D-systems-architecture` | Architecture | `fail` | `systems-architecture` verdict BLOCK (`P-section-trust`) |
| `D-operability-report` | Operations | `fail` | `release-engineering` verdict BLOCK (`O-operations-doc`, `O-health-endpoint`) |
| `A-intent-anchored` | Provenance | `not_evaluated` | `PRODUCT.md` provenance is undeclared |
| `A-runtime` | Verification | `not_evaluated` | Runtime behavior not fully certified via automated replay |
| `D-frontend` | Frontend | `pass` | Frontend checker completed without rule violations |
| `D-backend-engineering` | Backend | `pass` | Backend checker completed without rule violations |
| `D-smoke-report` | Deployment | `pass` | Smoke test checks passed |

---

## 3. Findings & Evidence Table

| # | Severity | Area | Finding | Evidence / Location | Recommendation |
|---|---|---|---|---|---|
| 1 | **Critical** | Frontend / UX | Frontend interface is missing entirely; app cannot be used by staff or managers | `public/index.html:1` contains only `<main id="app"></main>` with no JS or CSS. `src/server.js` does not serve static UI files | Build the user interface as specified in `ux-walkthrough.md` and serve it from Express |
| 2 | **Critical** | Security / Auth | Self-authentication flaw: any user can claim manager status without credentials | `src/server.js:19-23` sets `req.session.isManager = Boolean(req.body.isManager)` directly from request body | Implement proper identity management and authentication for staff and managers |
| 3 | **High** | Correctness | `amountMinor` (claim amount) is not validated at all | `src/server.js:25-29` checks `category` and `spentOn`, but ignores `amountMinor` (accepting negative, zero, non-numeric, or missing values) | Add strict validation on `amountMinor` (positive integer check) |
| 4 | **High** | Security / AuthZ | Self-approval vulnerability: line managers can approve their own submitted claims | `src/server.js:33-37` check `req.session.isManager` but does not check if `claim.staffId === req.session.staffId` | Prevent managers from approving claims where `staffId` matches their own ID |
| 5 | **High** | Reliability | Data store file writes are non-atomic and prone to race conditions and ID collisions | `src/claims.js:10-13` uses raw `writeFileSync`; `src/claims.js:18` uses `c${state.claims.length + 1}` for IDs | Use atomic write operations (temp file + rename) and unique IDs (e.g. UUID) |
| 6 | **High** | Operations | Missing `/health` monitoring endpoint and operations documentation | `src/server.js` contains no health route; `D-operability-report` check fails `O-health-endpoint` and `O-operations-doc` | Add `/health` GET endpoint and document operational runbook/deployment procedures |
| 7 | **Medium** | Documentation | `ARCHITECTURE.md` missing required `Trust` specification section | `ARCHITECTURE.md:1-17` lacks a `## Trust` section; `D-systems-architecture` check fails `P-section-trust` | Add `## Trust` section to `ARCHITECTURE.md` defining security and boundary assumptions |
| 8 | **Medium** | Testing | Test suite is incomplete; covers only 1 unit function call and no HTTP endpoints | `test/claims.test.js:1-10` contains only 1 unit test for `submit()`; no error paths or API routes tested | Expand test suite to cover HTTP API endpoints (`supertest`), invalid input rejections, and manager approval checks |
| 9 | **Medium** | Documentation | `docs/build-notes.md` contains inaccurate claims regarding validation and testing completeness | `docs/build-notes.md:17-30` asserts all inputs are validated and error paths are tested | Update build notes to reflect true system state and unresolved defects |

---

## 4. UX Walkthrough Verification

Attempted step-by-step verification against `ux-walkthrough.md`:

1. **Step 1 (Open the page & view sign-in form):** **FAILED.** Opening `/` serves a blank HTML page (`public/index.html`) with no form or elements.
2. **Step 2 (Sign in):** **FAILED.** No sign-in form exists in the UI.
3. **Step 3 (Submit a claim):** **FAILED.** No claim submission form exists in the UI.
4. **Step 4 (Line manager approve claim):** **FAILED.** No manager view or approval action exists in the UI.
5. **Step 5 (Sign out):** **FAILED.** No sign-out button exists in the UI.

---

## 5. What Was Verified & What Was Excluded

### What Was Verified
- Executed `npm test` (`node --test test/claims.test.js`), passing 1 unit test.
- Executed `accept-check.js` in separate acceptor context, recording automated gate findings.
- Conducted targeted code reading of all repository files: `src/server.js`, `src/claims.js`, `public/index.html`, `test/claims.test.js`, `PRODUCT.md`, `ARCHITECTURE.md`, `ux-walkthrough.md`, `docs/build-notes.md`, and `package.json`.

### Coverage Gaps / What Was Excluded
- Live web browser interactions (blocked by absent UI).
- SSL/TLS session security in actual server environment (`cookie.secure: true` tested only under local Node process).
- Load/stress testing and multi-process file lock testing under heavy concurrency.
