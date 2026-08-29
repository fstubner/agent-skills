#!/usr/bin/env node
// Deterministic grader for design-system-drift.
//
// The project has no design system and three years of styling drift: seven
// near-identical greys, three near-identical reds, one blue serving four
// distinct roles, `14px` and `0.875rem` used interchangeably, and a calendar
// whose colours are computed at runtime and therefore are not literals at all.
//
// What is graded is whether the extraction DECIDED things — collapsed the
// drift, named what it collapsed, and said what it could not see — not
// whether a design-tokens.json appeared. A token file that faithfully
// transcribes all seven greys has extracted nothing; it has reformatted the
// problem.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node design-system-drift.mjs --root <workspace>');
  process.exit(2);
}

const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const readIf = (rel) => {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
};

// The drift as it exists in the source, measured rather than assumed.
const GREYS = ['#6b7280', '#6c7280', '#6b7480', '#6e7681', '#707680', '#71717a', '#737373'];
const REDS = ['#dc2626', '#dc2727', '#d92626'];
const BRAND = '#2563eb';

function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const sourceFiles = walk(path.join(root, 'src'));
const sourceText = sourceFiles.map((f) => {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}).join('\n');

// styles/legacy.css writes its colours as rgb(), and every one of them is a
// value that also appears as hex elsewhere. Both forms normalise to the same
// key here so that a token emitted either way counts as grounded — the trap is
// for the extraction that never looks at legacy.css, not for one that writes
// `rgb(107, 114, 128)` instead of `#6b7280`.
const rgbToHex = (r, g, b) => `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`;
function coloursIn(text) {
  const out = [...text.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase());
  for (const m of text.matchAll(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/g)) out.push(rgbToHex(m[1], m[2], m[3]));
  return out;
}
const sourceHex = new Set(coloursIn(sourceText));

// The write-up. Named broadly because the case prompt asks for a design
// system document without dictating a filename.
const writeup = ['DESIGN-SYSTEM.md', 'design-system.md', 'DESIGN.md', 'design-direction.md', 'README-design.md', 'TOKENS.md']
  .map(readIf).find(Boolean) || '';
const low = writeup.toLowerCase();

// The token file, wherever a reasonable extraction would put it.
const tokenRaw = ['design-tokens.json', 'src/design-tokens.json', 'tokens.json', 'src/tokens.json']
  .map(readIf).find(Boolean) || '';
let tokens = null;
try { tokens = tokenRaw ? JSON.parse(tokenRaw) : null; } catch { tokens = null; }

record('tokens-file-produced', tokens !== null && typeof tokens === 'object',
  tokenRaw ? `token file present; parses=${tokens !== null}` : 'no token file found');

// Flatten to any depth. A one-level version shipped first, copied from
// check-frontend's tokenSetsFrom — which limits depth on purpose, because it
// has to know which theme a colour belongs to before checking contrast. This
// grader only asks WHICH COLOURS WERE DECLARED, so nesting is irrelevant and
// a depth limit is a blind spot: the first control run wrote
// `colors.text.body` three levels down and the grader read the file as having
// no colours at all. It failed the drift assertions for the wrong reason,
// reporting "0 of the 7 source greys survive" when all 7 did.
function tokenValues(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (node && typeof node === 'object') for (const v of Object.values(node)) tokenValues(v, out);
  return out;
}
const values = tokenValues(tokens);
const colorValues = values.flatMap((v) => coloursIn(v.toLowerCase().trim()));

// Invented colours are the failure mode where a "design system" describes a
// product nobody has built. A canonical value chosen from the drift is fine;
// a value that appears nowhere in the source is not.
const grounded = colorValues.filter((v) => sourceHex.has(v));
const groundedRatio = colorValues.length ? grounded.length / colorValues.length : 0;
record('tokens-grounded-in-code', colorValues.length > 0 && groundedRatio >= 0.7,
  `${grounded.length}/${colorValues.length} token colours appear in src (${(groundedRatio * 100).toFixed(0)}%)`);

// The core of the task. Seven greys in, at most three out.
const greysKept = GREYS.filter((g) => colorValues.includes(g));
record('grey-drift-collapsed', colorValues.length > 0 && greysKept.length <= 3,
  `${greysKept.length} of the 7 source greys survive as distinct tokens: ${greysKept.join(', ') || 'none'}`);

const redsKept = REDS.filter((r) => colorValues.includes(r));
record('red-drift-collapsed', colorValues.length > 0 && redsKept.length <= 1,
  `${redsKept.length} of the 3 source reds survive as distinct tokens: ${redsKept.join(', ') || 'none'}`);

// Collapsing silently is half the job — the next person needs to know which
// values were treated as the same and why.
const namesGreyDrift = /(grey|gray)/i.test(writeup)
  && (GREYS.some((g) => low.includes(g)) || /\b(seven|7)\b[^.\n]{0,40}(grey|gray)/i.test(writeup)
    || /(near-?identical|near-?duplicate|almost identical|indistinguishable|collaps|consolidat|merg)/i.test(writeup));
record('drift-named-not-just-fixed', namesGreyDrift,
  `write-up identifies the grey drift it collapsed=${namesGreyDrift}`);

// 14px and 0.875rem are the same size wearing different clothes. An
// extraction that emits both as separate scale steps has copied the bug.
const unitsCaught = /0\.875\s*rem/i.test(writeup) && /14\s*px/i.test(writeup);
record('unit-equivalence-caught', unitsCaught,
  `write-up reconciles 0.875rem with 14px=${unitsCaught}`);

// One blue, four jobs: link, primary button, focus ring, calendar "now".
// Either answer is defensible; not noticing is not.
const roles = ['link', 'button', 'primary', 'focus', 'calendar', 'now'];
const roleHits = roles.filter((r) => low.includes(r)).length;
const brandDecided = low.includes(BRAND) && roleHits >= 2;
record('shared-value-roles-decided', brandDecided,
  `write-up discusses ${BRAND} against ${roleHits} of its roles`);

// styles/legacy.css writes nine colours as rgb()/hsl()/`white`, every one of
// them a value that also appears as hex somewhere else. An extraction that
// greps for `#` misses the file entirely and then quotes a coverage number as
// though it had read everything.
const altFormsSeen = /(rgb\(|rgba\(|hsl\(|legacy\.css)/i.test(writeup);
const altFormsUnified = altFormsSeen
  && /(same|identical|equivalent|duplicate|dupli|unif|normalis|normaliz|convert|already|also appears|both forms)/i.test(writeup);
record('alternate-colour-forms-unified', altFormsUnified,
  `notices non-hex colour forms=${altFormsSeen}; treats them as the same values=${altFormsUnified}`);

// styles/vars.css declares --brand: #2563ea. Everywhere else the brand is
// #2563eb. One character apart, adopted by a single screen, and the kind of
// thing an extraction either finds or silently launders into the token file.
const contradictionCaught = /#2563ea\b/i.test(writeup)
  || (/vars\.css|--brand/i.test(writeup) && /(differ|discrepan|mismatch|conflict|inconsist|typo|one character|off by)/i.test(writeup));
record('contradictory-variable-caught', contradictionCaught,
  `write-up reconciles --brand #2563ea against #2563eb=${contradictionCaught}`);

// The calendar computes its colours at runtime, so they are not literals and
// cannot be extracted by reading the source. Saying so is the difference
// between a coverage number and an honest one.
const runtimeFlagged = /(runtime|computed|calculated|derived at run|Calendar\.jsx)/i.test(writeup)
  && /(calendar|density|mix|shade|band)/i.test(writeup);
record('runtime-colours-declared-out-of-reach', runtimeFlagged,
  `write-up says the computed calendar colours are outside the extraction=${runtimeFlagged}`);

// Extraction, not renovation. The components keep their literals until
// somebody decides to migrate them; rewriting them here is a different task
// with a different blast radius.
const baseCss = readIf('src/styles/base.css');
record('product-unchanged', /#6c7280/.test(baseCss),
  'src/styles/base.css must keep its drifted literals; extraction proposes, it does not migrate');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'design-system-drift', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
