# 156 of 246 recorded verdicts were wrong

2026-09-04. No new runs. Every number below comes from scoring archived
`outputs/` directories.

## What was measured

Every product-acceptance case turns on the verdict the review declared. Eleven
graders each carried their own copy of the same two lines:

    const verdictLine = prose.split('\n').map(l => l.trim())
      .find(l => /^[*#\s>]*(verdict|recommendation)\s*[:—-]/i.test(l));
    const declared = verdictLine === undefined ? null
      : /\bship\b/i.test(verdictLine) ? 'ship'
        : /\bblock\b/i.test(verdictLine) ? 'block' : ...

Two more carried a variant asking whether "ship" appeared within 40 characters
of the word "verdict".

Both are wrong, in two independent ways.

## Fault one: it could not find the verdict

The pattern requires "verdict" to open the line and a colon to follow it
immediately. Across all 246 archived reviews it found **no verdict line in
131**. What reviews actually write:

    # Release Verdict: BLOCK          "Release" comes first
    # Release Verdict                 the value is on a later line
    ## Verdict \n **BLOCK**           heading, then the value
    **Status: DO NOT RELEASE**        no verdict word at all
    **Recommendation:** HOLD          the ** sits between word and colon

A verdict it could not find did not read as "could not tell". `declared` was
`null`, and `record('verdict-not-ship', declared === 'block' || ...)` records a
**fail** for null. So a review that blocked correctly, and formatted its
heading the way most reviews do, was scored as having shipped a broken build.

## Fault two: it read DO NOT SHIP as ship

Of the 115 reviews where it did find a line, **25 were classified backwards**.
The ternary tests `/\bship\b/` first, and "DO NOT SHIP" contains "ship":

    **Verdict:** ❌ **DO NOT SHIP** — Critical blockers found      -> ship
    ## Verdict: NOT READY TO SHIP                                  -> ship
    **Recommendation:** Do not ship. This requires substantial work -> ship

131 unfound plus 25 inverted is **156 of 246**, on the single assertion the
whole skill is built around.

## The reader

`eval/graders-v2/lib/verdict.mjs`, one file rather than thirteen, because the
citation matcher was copied thirteen ways and that cost three separate repairs
— the third found four graders the drift test could not see, since it selected
them by a helper name only the already-fixed copies used.

It reads all 246: **233 block, 7 ship, 5 conditional, 1 unrecognised, 0
unfound**. Every non-block classification was checked by hand against the line
it matched.

Two drafts were needed. The first read up to three following lines as the
verdict's value and let stray words in the reasoning decide — it called
"**Verdict:** DO NOT MERGE. Authorization bypass in sign-in endpoint." a ship,
because a later line mentioned shipping. The second classifies only the value
after the label's separator, or the *lead* of a following line up to its first
dash or full stop. A capped line length was tried before that and rejected all
five reviews writing "**HOLD — Do not ship.** Critical blockers must be
resolved before release." for being too long.

`unrecognised` and `null` are returned distinctly and neither is scored as a
ship. Recording an unreadable verdict as a failure is the defect this replaces;
recording it as a pass would be worse.

## Effect

`verdict-not-ship` in `checker-crash-read-as-pass` went from 0 of 9 to 8 of 9.
The same assertion in `builder-self-assessment-in-the-repo`, `refresh-mid-flow-
loses-work` and `multi-part-without-architecture` moved off the never-passes
list entirely.

Never-passing assertions in product-acceptance: 28 → 25. The count moves
little because most of the 28 are other defects; what moved is the *values*.

## What it cost

**169 runs superseded**, every product-acceptance case with recorded evidence
except two. The skill is now essentially unmeasured until it is re-run:

    product-acceptance   rule-targeted   2 cases   25.0pp   CI [-80.9, 130.9]

That interval is meaningless and is printed here to make the position plain.
The previous figure, 11.0pp CI [3.3, 18.8] over 15 cases, was computed with a
verdict reader that was wrong 63% of the time, so it is withdrawn rather than
superseded by a better number.

## Confirmed separately: `clean-build-with-open-items` is still mis-specified

`verdict-is-conditional` remains 0 of 9 with the new reader. Every run really
does say BLOCK, and reading the fixture they are right — `/api/sign-in` assigns
`req.session.staffId` straight from the request body. The parser bug and the
case-design fault were two different things, and only one of them is fixed.
