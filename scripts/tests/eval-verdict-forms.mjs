// The verdict reader, against the headings real reviews actually write.
//
// Two faults are pinned here, both measured across all 246 archived reviews on
// 2026-09-04. The parser the graders carried required "verdict" to open the
// line with a colon straight after, and found nothing in 131 of them. Of the
// 115 it did find, 25 were classified BACKWARDS, because it tested /\bship\b/
// before anything else and "DO NOT SHIP" contains "ship".
//
// 156 of 246 recorded verdicts were wrong, on the single assertion every
// product-acceptance case turns on.
//
// Every specimen below is a heading copied from an archived review.
import assert from 'assert';
import { declaredVerdict } from '../../eval/graders-v2/lib/verdict.mjs';

const CASES = [
  // --- the inversion: all of these were recorded as SHIP ---
  ['**Verdict:** ❌ **DO NOT SHIP** — Critical blockers found', 'block'],
  ['**Verdict: DO NOT SHIP**', 'block'],
  ['## Verdict: NOT READY TO SHIP', 'block'],
  ['## Verdict: ❌ NOT READY TO SHIP', 'block'],
  ['**Recommendation:** Do not ship. This requires substantial work.', 'block'],
  ['**Verdict:** DO NOT MERGE. Authorization bypass in sign-in endpoint.', 'block'],
  ['**Verdict:** ⚠️ **NOT PRODUCTION-READY** — Critical authorization gaps must be closed.', 'block'],
  ['**Status**: Release should not proceed. Core logic must be corrected before shipping.', 'block'],

  // --- the 131 the old parser could not find at all ---
  ['# Release Verdict: BLOCK', 'block'],
  ['# Release Verdict: NOT APPROVED', 'block'],
  ['# Release Verdict: HOLD', 'block'],
  ['**Status: DO NOT RELEASE** — Critical security issues must be resolved.', 'block'],
  ['## Status: DO NOT SHIP', 'block'],
  ['# Release verdict: FAIL', 'block'],
  ['## Verdict: FAILED', 'block'],

  // --- the value on a following line, with a justification after it ---
  ['# Release verdict\n**HOLD — Do not ship.** Critical blockers must be resolved before release.', 'block'],
  ['# Release Verdict\n## Status\n**NOT READY FOR RELEASE** — Critical issues prevent deployment.', 'block'],
  ['# Release Verdict\n## Summary\n**FAIL** — The primary export flow does not satisfy the requirement.', 'block'],
  ['## Verdict\n**Reject for release.** The primary export flow omits items with a zero count.', 'block'],
  ['## Verdict\n\n**BLOCK**', 'block'],
  ['# Invoice List — Release Verdict\n\n**BLOCK**\n\n**Do not ship.**', 'block'],

  // --- verdicts that really are approvals or conditionals ---
  ['VERDICT: SHIP', 'ship'],
  ['**Verdict:** APPROVED', 'ship'],
  ['**Verdict:** APPROVED FOR RELEASE', 'ship'],
  ['## Verdict: PASS', 'ship'],
  ['**Status:** PASSED', 'ship'],
  ['## Verdict: CONDITIONAL — proceed to production with noted gaps', 'conditional'],
  ['**Verdict:** CONDITIONAL PASS', 'conditional'],
  ['**Status:** ⚠️ Conditional Pass — Walkthrough passed, but gaps remain.', 'conditional'],

  // --- and a review that declares nothing ---
  ['# Release Review: inventory-export\n\nThe CLI has a defect in the export flow.', null],
];

for (const [report, expected] of CASES) {
  const { verdict } = declaredVerdict(report);
  assert.strictEqual(verdict, expected,
    `${JSON.stringify(report.slice(0, 70))}\n  expected ${expected}, got ${verdict}`);
}

// A paragraph under a verdict heading is discussion, not the verdict. An
// earlier draft read three whole following lines and let a stray "shipping"
// in the reasoning decide; that is how DO NOT MERGE came out as a ship.
const discussion = '## Verdict\n\nWe considered whether shipping this week is feasible and concluded it is not, '
  + 'because the approved design is not implemented.';
assert.notStrictEqual(declaredVerdict(discussion).verdict, 'ship',
  'a paragraph mentioning "shipping" must not be read as a ship verdict');

// An unreadable verdict must never be silently treated as either extreme.
assert.strictEqual(declaredVerdict('## Verdict\n\nSee the table below.').verdict, 'unrecognised');
assert.strictEqual(declaredVerdict('# Some review\n\nNo verdict here.').verdict, null);

console.log(`eval-verdict-forms: ${CASES.length + 3} verdict forms read correctly`);
