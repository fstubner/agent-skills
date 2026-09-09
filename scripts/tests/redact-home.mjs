// The machine that ran an eval must not travel with the evidence.
//
// Found by audit on 2026-09-08: 951 occurrences of a home-directory path
// across 136 committed files, in a public repository, because every harness
// records its own working directory and the bundles are committed whole.
//
// The captured text is redacted as it is written. The workspace tree is not,
// and must not be: outputs/ is covered by artifactSha256, and a bundle whose
// artifact hash does not match its outputs is not evidence any more. That
// asymmetry is the thing most likely to be "tidied up" by someone later, so
// it is pinned here as well as commented there.
import fs from 'fs';
import path from 'path';
import { expect, root } from './harness.mjs';
import { redactHome } from '../lib/redact-home.mjs';

const HOME = 'C:\\Users\\Someone';

expect('redacts a backslash path', redactHome(`ran in ${HOME}\\.gemini`, HOME) === 'ran in <home>\\.gemini');
expect('redacts a forward-slash path', redactHome('cwd C:/Users/Someone/.codex', HOME) === 'cwd <home>/.codex');
// transcript.jsonl is JSON, so the path arrives with its separators escaped.
// A redaction that missed this form would leave the username in the one file
// that has the most of them.
expect('redacts the JSON-escaped form transcripts carry',
  redactHome('{"cwd":"C:\\\\Users\\\\Someone\\\\x"}', HOME) === '{"cwd":"<home>\\\\x"}',
  redactHome('{"cwd":"C:\\\\Users\\\\Someone\\\\x"}', HOME));
expect('leaves unrelated text alone', redactHome('C:\\Users\\Other\\x', HOME) === 'C:\\Users\\Other\\x');
expect('survives empty input', redactHome('', HOME) === '' && redactHome(null, HOME) === null);

// A POSIX home has no backslash form to escape; the replacement must not
// invent one.
expect('handles a POSIX home directory',
  redactHome('at /home/someone/projects', '/home/someone') === 'at <home>/projects',
  redactHome('at /home/someone/projects', '/home/someone'));

const runner = fs.readFileSync(path.join(root, 'scripts', 'eval-run.mjs'), 'utf8');
for (const file of ['transcript.jsonl', 'stderr.txt', 'grader-raw.txt', 'grader-stderr.txt', 'grading.json']) {
  const line = runner.split('\n').find((l) => l.includes(`'${file}'`) && l.includes('writeFileSync'));
  expect(`eval-run redacts ${file} as it is written`, Boolean(line) && line.includes('redactHome('), line || 'no write found');
}
// And the one place it must NOT reach.
expect('eval-run does not redact the hash-bound workspace copy',
  /copyTree\(workspace, outputsDir, EXCLUDED_OUTPUTS\)/.test(runner),
  'outputs/ must be copied verbatim: artifactSha256 binds it');
