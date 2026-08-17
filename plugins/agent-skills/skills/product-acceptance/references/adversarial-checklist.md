# Adversarial acceptance checklist

Run after `accept-check.js` is green enough to bother. You are trying to
make the app fail, not to confirm it works.

## A — Contract

- [ ] `PRODUCT.md` Success condition: literally attempt it, end to end.
- [ ] Each MVP bullet: built, or explicitly deferred with the human's sign-off?
- [ ] Anything shipped that Anti-goals excludes?

## B — Primary path (from ux-walkthrough.md)

- [ ] Replay every step exactly as written; any deviation is a finding.
- [ ] Replay the primary path at the narrowest viewport the walkthrough
      claims to support (or 375px if it doesn't say) — not just the width
      it was designed at.
- [ ] Complete the primary job with keyboard only.
- [ ] Reload mid-flow at the two worst moments; state must land sensibly.

## C — Empty, error, loading, garbage

- [ ] First-run experience: truly empty data — every collection view.
- [ ] Throttle the network (or add artificial delay): does the primary
      action show a busy state, or does the UI look frozen/unresponsive?
- [ ] Kill the server (or block the API) mid-use: human-readable error + retry path?
- [ ] Paste 10k characters, emoji, `<script>alert(1)</script>`, and `' OR 1=1--`
      into every text input on the primary path.
- [ ] Submit the same mutation twice, fast. Duplicate rows?

## D — Evidence honesty

- [ ] The gate re-ran the checkers itself — do NOT accept report JSONs from
      the repo as evidence of anything.
- [ ] Was this context the builder? Then the cap applies: report CONDITIONAL
      and hand SHIP to a separate acceptance context.

## Verdict rules

- Any primary-path failure → BLOCK.
- Missing empty/loading/error states on the primary view → BLOCK.
- Cosmetic findings off the primary path → CONDITIONAL with a list.
- SHIP only when A-D produced no blocking finding and the gate says SHIP.
