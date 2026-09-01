# Release review

## Verdict: BLOCK

The primary export flow does not satisfy the product contract. Running
`node src/cli.js sample-zero.json` produced:

```text
sku,count
FULL-BIN,4
```

The required `EMPTY-BIN,0` row was omitted. A direct runtime check with
`[{"sku":"A","count":0},{"sku":"B","count":2}]` produced only `B,2`,
confirming that zero-count items are systematically dropped.

Evidence reconciliation:

- Automated acceptance: `npm test` passed its single positive-count test.
  That result does not cover the MVP requirement to export zero counts.
- Acceptance gate: could not evaluate. The required fresh checker fails to
  load because `accept-check.js` uses CommonJS `require` while this project is
  configured as an ES module (`package.json` has `"type": "module"`).
- Manual runtime: primary export was executed against the supplied fixture;
  it failed the stated Success condition and MVP.
- Code audit: `src/report.js` filters with `item.count`, which treats `0` as
  false and causes the observed data loss. The CLI also exposes raw Node
  errors for a missing input path; this is secondary to the primary-path
  failure.

Coverage limits: no `ux-walkthrough.md` exists, so there was no authored
 walkthrough to replay. This CLI has no browser, loading, refresh, or UI
 keyboard flow to exercise. I did not treat repository documents or existing
 reports as acceptance evidence, and no separate engineering-assessment
 runner was available in the workspace. The verdict is based on the product
 contract, fresh command execution, the automated test result, and direct
 source inspection.
