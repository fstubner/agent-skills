# Length-controlled judge: the skill's 10-of-12 becomes 7-of-12

The unmodified blind judge gave the skill arm 10 wins from 12, and agreed with
the byte count 12 times out of 12 — it could not distinguish better from
bigger. This re-runs the same twelve pairs with both deliverables cut to the
same length.

| pass | skill | policy |
|---|---|---|
| unmodified | 10 | 2 |
| length-controlled | **7** | **5** |

Three verdicts flipped, every one of them skill → policy.

**7 of 12 is not a result.** P(at least 7 of 12 by chance) = 0.387. Under
length control the judge shows no preference this sample can distinguish from
a coin toss.

## What was done

Both reports are cut to the shorter one's byte length at a line boundary, so
the judge cannot see which agent wrote more. All twelve pairs recorded the
control and in all twelve a report was actually cut, so nothing passed through
uncontrolled.

The prompt tells the judge a report was truncated and that an abrupt ending,
missing summary or absent closing section is an artefact rather than a defect.
Without that sentence the cut would simply invert the bias: only the LONGER
report is trimmed, so it is the only one that can end mid-thought, and
penalising that would hand the win to whichever agent wrote less.

## What this still does not settle

Truncation removes the length signal and adds a smaller one. Only the longer
report is cut, so a report that front-loads its findings is flattered and one
that saves its conclusions for a closing section is penalised. Three of the
five policy wins came from pairs where the skill report lost its tail, and
that is a plausible alternative reading of the flips.

Two confounds from the first pass are untouched: haiku judged its own outputs
in six of the twelve pairs, and the judge model is the same one that produced
the claude-code arms. A judge outside the family would test that.

## Why this matters for the suite

The deterministic assertions put engineering-assessment at an outcome delta of
0.2725 with a 95% CI lower bound of 0.0355 against a 0.1 bar. The unmodified
judge appeared to contradict that. It no longer does: with length controlled,
the holistic comparison agrees with the assertions that there is no
demonstrated win.

Both passes remain `evidentiary: false` and neither feeds promotion.
