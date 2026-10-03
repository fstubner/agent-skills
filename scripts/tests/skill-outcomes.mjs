// scripts/skill-outcomes.mjs produces the field-delivery numbers the README
// quotes, and until 2026-10-03 it had no test at all — flagged as a gap in
// eval/results/self-assessment-2026-09-03.md.
//
// The two failure modes pinned here are the ones that actually bit, both found
// while re-running the 2026-09-02 report on 2026-10-03:
//
//   1. One invocation counted several times. A resumed session copies its
//      earlier turns into a new transcript and a compacted one can repeat a
//      turn in place, so 13 of 140 rows in the published window were the same
//      calls seen twice. Published counts were inflated by it.
//   2. A prompt that names the skill read as model-chosen. The trigger rule
//      required whitespace before the name, so `` `agent-skills:x` `` and
//      skill "agent-skills:x" were misread as the model's own choice — which
//      is the single number the README leans on hardest. The trailing \b had
//      the mirror-image bug: a prompt naming frontend-design matched the
//      skill `frontend`.
//
// Both are asserted against a synthetic store, so the test does not depend on
// what happens to be in ~/.claude/projects today.
import fs from 'fs';
import path from 'path';
import { root, expect, tmpBase, runNode } from './harness.mjs';

const script = path.join(root, 'scripts', 'skill-outcomes.mjs');
const store = fs.mkdtempSync(path.join(tmpBase, 'outcomes-store-'));

// A transcript is a user turn, then an assistant turn calling the Skill tool.
// `id` is the tool_use id: minted once by the API, copied verbatim by a resume.
const transcript = (turns) => turns.map((t) => JSON.stringify(t)).join('\n') + '\n';
const userTurn = (text, ts) => ({ type: 'user', timestamp: ts, message: { content: [{ type: 'text', text }] } });
const skillTurn = (skill, id, ts) => ({
  type: 'assistant',
  timestamp: ts,
  message: { content: [{ type: 'tool_use', name: 'Skill', id, input: { skill: `agent-skills:${skill}` } }] },
});

const project = path.join(store, 'H--projects-demo');
fs.mkdirSync(project, { recursive: true });

// Session A: the model picks product-acceptance off a plain request.
fs.writeFileSync(path.join(project, 'a.jsonl'), transcript([
  userTurn('is this done?', '2026-09-10T10:00:00.000Z'),
  skillTurn('product-acceptance', 'toolu_aaa', '2026-09-10T10:00:01.000Z'),
]));
// Session B: a resume of A — same turns, same tool_use id — plus a new call.
fs.writeFileSync(path.join(project, 'b.jsonl'), transcript([
  userTurn('is this done?', '2026-09-10T10:00:00.000Z'),
  skillTurn('product-acceptance', 'toolu_aaa', '2026-09-10T10:00:01.000Z'),
  userTurn('now run the prose pass', '2026-09-11T09:00:00.000Z'),
  skillTurn('ai-prose-slop', 'toolu_bbb', '2026-09-11T09:00:01.000Z'),
]));
// Session C: the same id twice inside one file, as a compacted transcript can.
fs.writeFileSync(path.join(project, 'c.jsonl'), transcript([
  userTurn('audit it', '2026-09-12T09:00:00.000Z'),
  skillTurn('engineering-assessment', 'toolu_ccc', '2026-09-12T09:00:01.000Z'),
  skillTurn('engineering-assessment', 'toolu_ccc', '2026-09-12T09:00:01.000Z'),
]));
// Session D: outside the window asked for below.
fs.writeFileSync(path.join(project, 'd.jsonl'), transcript([
  userTurn('audit it', '2026-07-01T09:00:00.000Z'),
  skillTurn('engineering-assessment', 'toolu_ddd', '2026-07-01T09:00:01.000Z'),
]));
// Session E: the prompt names the skill in backticks, and names a different
// skill whose id is a prefix of this one.
fs.writeFileSync(path.join(project, 'e.jsonl'), transcript([
  userTurn('Invoke the skill `agent-skills:product-acceptance` and follow it', '2026-09-13T09:00:00.000Z'),
  skillTurn('product-acceptance', 'toolu_eee', '2026-09-13T09:00:01.000Z'),
]));
// Session F: "frontend-design" must NOT count as naming `frontend`.
fs.writeFileSync(path.join(project, 'f.jsonl'), transcript([
  userTurn('apply the frontend-design guidance here', '2026-09-14T09:00:00.000Z'),
  skillTurn('frontend', 'toolu_fff', '2026-09-14T09:00:01.000Z'),
]));

const run = runNode(script, ['--projects', store, '--from', '2026-09-01', '--to', '2026-09-30', '--json']);
let out = null;
try { out = JSON.parse(run.stdout); } catch { /* asserted next */ }
expect('skill-outcomes: emits parseable JSON', out !== null, (run.stderr || run.stdout || '').slice(0, 300));

if (out) {
  const ids = out.rows.map((r) => r.id).sort();

  expect('skill-outcomes: a resumed session does not double-count an invocation',
    out.rows.filter((r) => r.id === 'toolu_aaa').length === 1,
    JSON.stringify(ids));
  expect('skill-outcomes: the same tool_use id twice in one file counts once',
    out.rows.filter((r) => r.id === 'toolu_ccc').length === 1,
    JSON.stringify(ids));
  expect('skill-outcomes: reports how many duplicates it removed',
    out.duplicatesRemoved === 2 && out.found === out.invocations + 2,
    `found=${out.found} invocations=${out.invocations} duplicates=${out.duplicatesRemoved}`);

  expect('skill-outcomes: --from/--to excludes an invocation outside the window',
    !ids.includes('toolu_ddd'), JSON.stringify(ids));
  expect('skill-outcomes: counts every invocation inside the window',
    out.invocations === 5, `${out.invocations}: ${JSON.stringify(ids)}`);

  const triggerOf = (id) => out.rows.find((r) => r.id === id)?.trigger;
  expect('skill-outcomes: a backticked skill name is the human typing it',
    triggerOf('toolu_eee') === 'user-typed', String(triggerOf('toolu_eee')));
  expect('skill-outcomes: a plain request is model-chosen',
    triggerOf('toolu_aaa') === 'model-chosen', String(triggerOf('toolu_aaa')));
  expect('skill-outcomes: naming frontend-design does not count as naming frontend',
    triggerOf('toolu_fff') === 'model-chosen', String(triggerOf('toolu_fff')));
}
