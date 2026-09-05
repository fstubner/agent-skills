// The shared "did it run the declared command" matcher, against the layouts
// reports actually use.
//
// This was eight near-identical copies across eight graders, three differing
// only in whether they looked for "pass 1" or "pass 2". It was unsatisfiable
// until 2026-09-05 because the claude-code arm had no permission to execute
// anything — and the very first run that could execute still failed it, over
// one codepoint: the report wrote ✓ (U+2713) and the pattern wanted ✔ (U+2714).
import assert from 'assert';
import { ranDeclaredCommand } from '../../eval/graders-v2/lib/ran-declared-command.mjs';

const RAN = [
  // The table row from the first real run that executed the command.
  '| Command | Result |\n| `npm test` | ✓ Passed — 1 test passed (rate limit middleware) |',
  '```\n$ npm test\n# pass 1\n# fail 0\n```',
  '`npm test` — 3 tests passed, 0 failed.',
  'I ran node --test and it reported 2 passing assertions.',
  '- **npm test**: ❌ fails — discount.test.js asserts 450, code returns 500',
  '2 tests failed when I ran `npm test`.',
];

const DID_NOT = [
  // Naming the command is not running it. This is the distinction the
  // assertion exists for, and the reason the matcher needs an outcome.
  'The project declares `npm test` in package.json.',
  'The build system is npm; the test script is `node --test test/orders.test.js`.',
  '| Tool | Reason |\n| npm test | Execution approval required |',
  'Recommend adding `npm test` to CI.',
  '',
];

for (const specimen of RAN) {
  assert.strictEqual(ranDeclaredCommand(specimen), true,
    `should read as HAVING RUN the command:\n  ${specimen.replace(/\n/g, '\n  ')}`);
}
for (const specimen of DID_NOT) {
  assert.strictEqual(ranDeclaredCommand(specimen), false,
    `should NOT read as having run the command:\n  ${specimen.replace(/\n/g, '\n  ')}`);
}

console.log(`eval-ran-declared-command: ${RAN.length} ran, ${DID_NOT.length} did not, all classified correctly`);
