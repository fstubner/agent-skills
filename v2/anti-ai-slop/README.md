# anti-ai-slop

Catch and fix AI-prose habits — inflated vocabulary, throat-clearing openers,
weasel attribution, importance inflation, summary-recap endings, em-dash
overuse — without flattening the writer's actual voice into generic polish.

Standalone utility skill. Not part of this repo's product-build pipeline; use
it any time you or an agent write prose — docs, PR descriptions, chat replies,
articles.

## What it catches

See [`references/patterns.md`](./references/patterns.md) for the full catalog
with rationale, examples, and false-positive caveats. Short version:

| Pattern | Checked by |
|---|---|
| Inflated vocabulary (*delve, leverage, robust, seamless...*) | Vale |
| Throat-clearing openers (*"Here's the thing," "Simply put"*) | Vale |
| Weasel attribution (*"studies show," "experts agree"*) | Vale |
| Importance inflation (*"marks a pivotal moment"*) | Vale |
| Summary-recap endings (*"In conclusion,"*) | Vale |
| Em-dash overuse | Vale |
| Binary-contrast framing, colon-reveal drama, synonym cycling, robotic rhythm | Judgment only — see `SKILL.md` |

## Use

**Detect** — ask whether a draft reads as AI-written:

```
Use anti-ai-slop to check if this reads as AI slop:

<paste draft>
```

You get back every pattern found, the quoted line, and a short fix. No score,
no authorship claim.

**Edit** — ask for a cleaned-up draft:

```
Use anti-ai-slop to edit this draft:

<paste draft>
```

You get the edited draft plus a **What changed** section.

**Direct lint** — run the deterministic layer yourself, no agent needed:

```bash
node anti-ai-slop/scripts/check-prose.js path/to/draft.md
```

Requires the real `vale` CLI on PATH. If it's missing, the script tells you
how to install it (`winget install errata-ai.Vale`, `brew install vale`,
`scoop install vale`, or a release tarball from
[errata-ai/vale](https://github.com/errata-ai/vale/releases)) rather than
silently skipping the check.

## Standalone Vale style

`rules/AntiAISlop/` works with any project that has Vale installed — it
doesn't need this skill or an agent. Copy the folder in and point your
`.vale.ini` at it:

```ini
StylesPath = path/to/AntiAISlop
MinAlertLevel = suggestion

[*.md]
BasedOnStyles = AntiAISlop
```

See [`rules/.vale.ini`](./rules/.vale.ini) for a runnable example.

## Files

| Path | Role |
|---|---|
| `SKILL.md` | Editing/detect rules and workflow (judgment layer) |
| `references/patterns.md` | Full pattern catalog with rationale and examples |
| `rules/AntiAISlop/*.yml` | Vale style rules (verification layer) |
| `rules/.vale.ini` | Example Vale config |
| `scripts/check-prose.js` | Shells out to real Vale, reports results as JSON |

## Sources of inspiration

Independently written, but the project owes a debt to Simon Willison's [LLM
cliché highlighter](https://simonwillison.net/2026/Jul/17/llm-cliche-highlighter/)
and Peter Yang's [`no-ai-slop`](https://github.com/petergyang/no-ai-slop) (MIT).
Neither is reproduced here.

## License

MIT — see the repo root [LICENSE](../LICENSE).
