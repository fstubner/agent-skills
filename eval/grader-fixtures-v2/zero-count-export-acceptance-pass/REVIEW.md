# Release review

## Verdict: BLOCK

The primary flow fails its product contract. Running `node src/cli.js sample-zero.json` exited 0 and observed:

```text
sku,count
FULL-BIN,4
```

The expected row `EMPTY-BIN,0` is missing. `src/report.js:3` filters on count truthiness, so it silently removes every valid zero count.

The automated acceptance gate reported SHIP, but that checker result is insufficient: it checks the product contract and project shape, while manual runtime verification contradicts it. The runtime failure overrides the automated gate, so release remains blocked. Add a zero-count acceptance test and change the filter in a separate build task; this review did not modify the product.
