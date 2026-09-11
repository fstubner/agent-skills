// The antigravity adapter must tell agy which directory it is working in.
//
// agy ignores the spawn cwd. It edits inside its own scratch directory
// (~/.gemini/antigravity-cli/scratch) and then reports the file it wrote as
// being "in the current working directory", which is how this went unnoticed:
// the transcript reads exactly like a successful run.
//
// The cost was the entire second-harness cohort. Only 6 of 38 antigravity runs
// recorded before 2026-09-06 put any file at all into their workspace — 5 of 22
// control, 0 of 9 policy, 1 of 7 skill — so the grader scored the untouched
// fixture. Every run of a case therefore produced an identical score in every
// arm: acceptance-clean-gate-dirty-code read 1/8 nine times, all-at-once-for-a-
// quiet-risk read 5/9 nine times. Zero variance, which looks like "the skill
// does nothing" and was actually "the model's work never arrived".
//
// Nothing in the hash-binding scheme catches this. caseSha256, fixtureSha256,
// graderSha256 and stagedInputSha256 all bind INPUTS; the harness invocation is
// not an input to any of them, so an adapter can silently stop delivering the
// treatment and every existing check stays green.
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..', '..');
// Moved out of eval-run.mjs on 2026-09-11, when that file passed the 400-line
// limit this repository enforces on itself and the harness dispatch was the
// coherent thing to extract. This test found the move by crashing on its
// anchor, which is the behaviour wanted from it — but it crashed rather than
// failing, because it asserts with bare `assert` instead of the suite's
// `expect`, so the runner counted zero assertions and zero failures. A module
// that aborts reads as green to anything counting lines.
const source = fs.readFileSync(path.join(root, 'scripts', 'lib', 'eval-harness-run.mjs'), 'utf8');

// The antigravity adapter, from its declaration to the spawnSync that runs it.
const start = source.indexOf('function runAntigravity(');
assert.ok(start > 0, 'the antigravity adapter has moved or been renamed');
const branch = source.slice(start, source.indexOf('spawnSync', start));

assert.match(branch, /'--add-dir',\s*workspace/,
  'the antigravity adapter must pass --add-dir <workspace>; without it agy writes to its own '
  + 'scratch directory and the grader scores an untouched fixture');

// And the prompt must still be attached to -p, which is the other thing this
// CLI is particular about: a detached `-p` swallows the next flag as its value.
assert.match(branch, /`-p=\$\{prompt\}`/,
  'agy needs its prompt attached as -p=<prompt>, not as a separate argument');

console.log('eval-harness-workspace: the antigravity adapter names its workspace');
