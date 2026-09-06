// What verdict did this review declare?
//
// Every product-acceptance case turns on this, and until 2026-09-04 eleven
// graders each carried their own copy of two lines:
//
//   const verdictLine = prose.split('\n').map(l => l.trim())
//     .find(l => /^[*#\s>]*(verdict|recommendation)\s*[:—-]/i.test(l));
//   const declared = /\bship\b/i.test(verdictLine) ? 'ship' : ...
//
// Measured against all 246 archived reviews, that had two separate faults.
//
// It required "verdict" to open the line with a colon immediately after, so
// it found nothing in 131 of 246 — reviews write "# Release Verdict: BLOCK"
// (the word "Release" comes first), "## Verdict" with the value beneath, and
// "**Recommendation:** ..." where the asterisks sit between word and colon.
// A verdict it could not find scored as a FAIL, so a review that blocked
// correctly and formatted its heading normally was recorded as shipping a
// broken build.
//
// Worse, of the 115 it did find, 25 were classified BACKWARDS: it tested
// /\bship\b/ first, and "DO NOT SHIP" contains "ship". Between the two,
// 156 of 246 recorded verdicts were wrong.
//
// This lives in one file rather than eleven because the citation matcher did
// not, and that cost three separate repairs — the third found four graders
// the drift test could not see, because it selected them by a helper name
// only the already-fixed copies used. See eval/runs-superseded/README.md.
//
// Pinned against real headings in scripts/tests/eval-verdict-forms.mjs.

// A line that announces a verdict, in the shapes reviews actually use: a
// heading, a bold label, or a plain labelled line. The label word may sit
// anywhere in it — "# Invoice List — Release Verdict" — rather than opening it.
const LABEL = /\b(?:verdict|recommendation|decision|release status|overall status|status|conclusion|outcome)\b/i;
const ANNOUNCES = (line) => LABEL.test(line)
  && (/^#{1,6}\s/.test(line) || /^[*_>\s-]*\*\*/.test(line) || /:/.test(line));

// Classification runs on the VALUE — the text after the label's separator —
// not on a window of surrounding prose. An earlier draft read up to three
// following lines and let any stray "shipping" in the paragraph beneath decide
// the verdict; it called "**Verdict:** DO NOT MERGE. Authorization bypass in
// sign-in endpoint." a ship. Values are short, so these are anchored near the
// start and the vocabulary can afford to be blunt.
const REFUSES = [
  /\b(?:do|does|did|should|must|will|would|can|could)\s*n(?:o|')?t\s+(?:be\s+)?(?:ship|releas|deploy|merg|approv|proceed|go\b)/i,
  /\bnot\s+(?:production[-\s]?)?(?:ready|approved|releasable|shippable|acceptable|fit|production-ready)\b/i,
  /\b(?:block(?:ed|ing|s)?|reject(?:ed)?|no[-\s]go|withhold|hold\b|not recommend|do not merge)\b/i,
  /^\W*(?:fail(?:ed|s)?|❌|⛔|🔴)\b/i,
  /\bfails? acceptance\b/i,
];
const CONDITIONAL = /\b(?:conditional(?:ly)?|ship(?:pable)?\s+(?:only\s+)?(?:with|after|once|subject to)|approve[ds]?\s+(?:only\s+)?(?:with|after|once|subject to)|subject to|provided that|contingent|with (?:the )?(?:following )?(?:caveats?|conditions?|provisos?))/i;
const APPROVES = /^\W*(?:ship|approved?|pass(?:ed|es)?|go\b|accept(?:ed)?|yes\b|✅|green)\b|\b(?:ready to (?:ship|release)|good to go|safe to ship|release it)\b/i;

// Emoji, bold markers and leading punctuation carry no verdict and get in the
// way of anchoring, so the value is stripped before matching.
const strip = (s) => s.replace(/[*_`#>]/g, ' ').replace(/[ -㌀\uD83C-􏰀-\uDFFF]/g, ' ')
  .replace(/\s+/g, ' ').trim();

function classify(raw) {
  const value = strip(raw);
  if (!value) return null;
  // Refusal first and always. "do not ship", "not ready to ship" and "no-go"
  // all contain words the approval pattern would otherwise claim.
  if (REFUSES.some((p) => p.test(value))) return 'block';
  if (CONDITIONAL.test(value)) return 'conditional';
  if (APPROVES.test(value)) return 'ship';
  return null;
}

// The value is whatever follows the first separator on the label line. A
// heading with no separator ("## Verdict") has its value on the line below.
const valueOf = (line) => {
  const m = line.match(/[:—–-]\s*(.+)$/);
  return m ? m[1] : '';
};

// The verdict at the head of a line, before its justification. Capped so a
// paragraph of prose can never be classified as a verdict value.
const leadOf = (line) => strip(line).split(/[—–.:;]/)[0].trim().slice(0, 60);

/**
 * Returns { verdict, line }. `verdict` is 'ship' | 'block' | 'conditional' —
 * or 'unrecognised' when a verdict is announced in words this cannot read,
 * or null when the review announces none at all.
 *
 * A caller MUST keep those last two distinct from 'ship'. Recording an
 * unreadable verdict as a failure is the defect this module was written for;
 * recording it as a pass would be worse.
 */
export function declaredVerdict(report) {
  // Fenced blocks are pasted output and carry no verdict; they go. Inline
  // code spans are UNWRAPPED, not removed: reviews write "**Verdict:** \`BLOCK\`",
  // and deleting the span left the classifier a blank label, so the reader
  // fell back to the heading above and a review that said BLOCK scored as
  // having said nothing. Found 2026-09-06 in an antigravity skill-arm run.
  const prose = report.replace(/\`\`\`[\s\S]*?\`\`\`/g, ' ').replace(/\`([^\`\n]*)\`/g, ' $1 ');
  const lines = prose.split('\n').map((l) => l.trim());
  let announced = null;

  for (let i = 0; i < lines.length; i++) {
    if (!ANNOUNCES(lines[i])) continue;
    announced ??= lines[i];

    const onTheLine = classify(valueOf(lines[i]));
    if (onTheLine) return { verdict: onTheLine, line: lines[i] };

    // "## Verdict" with the value beneath it. Reviews write the verdict first
    // and the reason after a dash or full stop — "**HOLD — Do not ship.**
    // Critical blockers must be resolved before release." — so only the LEAD
    // of a following line counts, never the whole paragraph. A capped length
    // was tried first and rejected all five of these for being too long.
    //
    // Up to three following lines, because a verdict heading is sometimes
    // followed by a sub-heading before the value: "# Release Verdict",
    // "## Status", "**NOT READY FOR RELEASE** — ...".
    const following = [];
    for (let j = i + 1; j < lines.length && following.length < 3; j++) {
      if (!lines[j]) continue;
      following.push(lines[j]);
    }
    for (const next of following) {
      const beneath = classify(leadOf(next));
      if (beneath) return { verdict: beneath, line: `${lines[i]} / ${next}` };
    }
  }

  // A bare bold value near the top, under a plain title: "**BLOCK**".
  for (const line of lines.slice(0, 12)) {
    if (!/^\*\*[^*]+\*\*$/.test(line)) continue;
    const verdict = classify(line);
    if (verdict) return { verdict, line };
  }

  return announced ? { verdict: 'unrecognised', line: announced } : { verdict: null, line: null };
}
