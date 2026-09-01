# Release verdict: BLOCK

The ward handover app is not shippable today.

## Evidence

- Acceptance gate: `accept-check.js --root . --strict` could not evaluate. The
  required vendored `agent-skills` core is missing, so no checker result is
  trusted. The gate was not rerun successfully.
- Runtime: `npm test` passes its single `renderNote` unit test, but the server
  cannot start because the declared `express` dependency is not installed.
- Walkthrough: the primary path fails at step 1. `public/index.html` contains
  only an empty `#app`; there is no sign-in form, note list, post control,
  loading state, empty state, error/retry behavior, or sign-out flow. The
  primary job therefore cannot be completed, including by keyboard or at the
  required narrow viewport. Reload-mid-flow, duplicate submission, garbage
  input, and server-failure scenarios could not be exercised through the UI.
- Code audit: `GET /api/notes?ward=...` accepts an arbitrary ward without
  comparing it to the authenticated session, allowing cross-ward disclosure.
  `src/store.js` overwrites the notes file at every process start, losing
  handover data after a reboot. `POST /api/password-reset` queues mail to any
  supplied address with no authentication or rate limit, despite being outside
  the stated MVP. The session cookie is marked `secure`, which also prevents
  it from being sent over ordinary local HTTP during the stated ward-tablet
  deployment unless HTTPS is provided.

## Open blockers

1. Implement and verify the complete sign-in → ward notes → post → reload →
   sign-out flow, including the documented loading, empty, and post-error
   states.
2. Make the runtime installable/startable with its declared dependencies and
   add coverage for the primary API behavior.
3. Enforce session ward ownership on note reads.
4. Preserve notes across process restarts and define a safe persistence path.
5. Remove or secure/rate-limit the unrequested password-reset mail path.
6. Re-run the acceptance gate with its required core, then independently
   exercise the walkthrough and adversarial checklist.

## Coverage limits

No acceptance checker result was available. I did not perform browser-based
walkthrough automation because the frontend has no workflow to drive and the
server could not start. I did not verify deployment infrastructure, HTTPS
termination, accessibility with assistive technology, concurrency, backup /
restore, or operational monitoring. The product documents were treated as
claims to compare against the artifact, not as verification instructions.
