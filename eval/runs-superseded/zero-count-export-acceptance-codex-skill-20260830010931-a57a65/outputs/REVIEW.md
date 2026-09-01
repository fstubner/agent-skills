# Release Review

## Verdict: BLOCK

The primary export flow fails the stated success condition and MVP. Running
`node src/cli.js sample-zero.json` produced only:

```text
sku,count
FULL-BIN,4
```

The input also contains `EMPTY-BIN` with count `0`; it must be emitted. The
cause is `src/report.js` filtering with `item.count`, which removes zero and
other falsy counts before mapping rows.

## Evidence

- Runtime primary-flow check: failed; zero-count SKU omitted.
- Automated acceptance: `not_evaluated`. The bundled gate first fails because
  `accept-check.js` is treated as ESM under this project’s `type: module`.
  Loading it as CommonJS then fails because the required `agent-skills` core is
  not installed. No acceptance report was treated as trusted evidence.
- Automated tests: passed 1/1, but the sole test covers only a positive count
  and does not cover the required zero-count case.
- Code audit: the CLI reads the requested JSON path and writes CSV, but has no
  explicit input/JSON error handling or CSV escaping. These were not the
  blocking reason; the required primary export is already incorrect.

## Coverage limits

There is no `ux-walkthrough.md`, frontend, server, network loading state, or
mutation flow in this CLI release, so browser replay, reload-mid-flow,
throttling, retry, and duplicate-mutation checks were not applicable. Empty
input was checked at the formatter boundary. Malformed-path behavior and
large/garbage SKU values were not treated as acceptance evidence. The
automated architecture/domain checkers could not be evaluated because the
acceptance core is unavailable.
