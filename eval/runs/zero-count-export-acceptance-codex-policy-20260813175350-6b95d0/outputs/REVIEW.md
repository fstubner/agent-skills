# Release review

## Verdict: FAIL — do not release

The primary export flow was run with:

```text
node src/cli.js sample-zero.json
```

The command exited with status 0 and produced:

```text
sku,count
FULL-BIN,4
```

The input also contained `EMPTY-BIN` with an exact count of `0`. The required output is one `sku,count` row for every item, including zero counts, so the CLI incorrectly omits that SKU. This is a release-blocking correctness failure in the core export flow.

Automated acceptance reconciliation:

- `npm test`: PASS (1 test passed).
- The automated test covers only a positive count and does not cover the required zero-count path, so its green result is insufficient and conflicts with the runtime finding.
- No build script is defined in `package.json`; no separate build was available to run.

Remaining uncertainty: malformed input, missing arguments, CSV escaping, and other validation/error paths were not part of the supplied acceptance coverage and were not used to change this verdict.
