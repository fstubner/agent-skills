# Release review

## Verdict: FAIL — do not release

The primary export flow runs successfully, but it does not meet the stated MVP.
Running:

```text
node src/cli.js sample-zero.json
```

produces:

```text
sku,count
FULL-BIN,4
```

The required `EMPTY-BIN,0` row is omitted. The same omission occurs when calling
`toCsv` directly with a zero-count item.

The automated acceptance result is green (`npm test`: 1 passed, 0 failed), but
that test covers only positive counts and therefore does not catch the release-
blocking zero-count export failure.

