// The reduced transcript must stay readable by the one check that reads it.
//
// Reduction narrows what a run bundle publishes: tool-call commands, the
// model's messages, and nothing else. The risk it introduces is precise — the
// ambient-skill guard in eval-eligibility.mjs is the only machine check that
// reads a transcript, and if reduction drops the shape it keys on, control
// arms that reached for an installed skill stop being detectable and the
// contamination becomes invisible rather than absent.
//
// That already happened once, on 2026-09-08, by a different route: redacting
// the home directory replaced the exact prefix the guard matches. So the first
// assertion here is not about bytes saved, it is that the guard still fires.
import { reduceTranscript, isReducedTranscript } from '../lib/reduce-transcript.mjs';
import { runEligibility } from '../lib/eval-eligibility.mjs';
import { expect } from './harness.mjs';

const line = (o) => `${JSON.stringify(o)}\n`;

// A codex turn: a tool call reaching into an installed skill, wrapped in the
// events that carry the machine — session_meta, the command's output, the
// account's plan tier.
const CODEX_RAW = [
  { timestamp: 't', type: 'session_meta', payload: { type: 'session_meta', cwd: 'C:\\Users\\Someone\\Documents\\Codex\\x', cli_version: '1.2.3' } },
  { timestamp: 't', type: 'turn_context', payload: { type: 'turn_context', plan_type: 'plus' } },
  { timestamp: 't', type: 'reasoning', payload: { type: 'reasoning', encrypted_content: 'gAAAAA...' } },
  { timestamp: 't', type: 'custom_tool_call', payload: { type: 'custom_tool_call', call_id: 'c1', input: 'const r = await tools.shell_command({command:"Get-Content <home>/.codex/skills/x/SKILL.md","workdir":"<home>/Documents/Codex/x"}); text(r)' } },
  { timestamp: 't', type: 'custom_tool_call_output', payload: { type: 'custom_tool_call_output', output: 'agentbox-ops: Operate the Linux host over SSH\nnvx: ...' } },
  { timestamp: 't', type: 'agent_message', payload: { type: 'agent_message', message: 'I read the skill and applied it.' } },
].map(line).join('');

const reduced = reduceTranscript(CODEX_RAW);

// THE ASSERTION THIS FILE EXISTS FOR.
const bundle = (transcript) => ({
  runDir: undefined,
  fixtureDir: undefined,
  testCase: { id: 'tc' },
  transcript,
  manifest: { condition: 'control', exitCode: 0, grading: { notEvaluated: 0 }, totalTokens: 10, costUsd: 0.01, harness: 'codex' },
});
expect('the ambient-skill guard still fires on a reduced transcript',
  /ambient installed skill accessed/.test(runEligibility(bundle(reduced)) ?? ''),
  runEligibility(bundle(reduced)) ?? 'eligible');
expect('and fired on the raw one too, so the comparison means something',
  /ambient installed skill accessed/.test(runEligibility(bundle(CODEX_RAW)) ?? ''));

// What must not survive. Each of these is a real leak found in the corpus.
for (const gone of ['session_meta', 'plan_type', 'encrypted_content', 'agentbox-ops', 'nvx:', 'cli_version', '"call_id"']) {
  expect(`reduction drops ${gone}`, !reduced.includes(gone), reduced.slice(0, 200));
}
// What must survive.
expect('the tool-call command survives', reduced.includes('Get-Content <home>/.codex/skills/x/SKILL.md'));
expect('the agent message survives', reduced.includes('I read the skill and applied it.'));

// An allowlist drops what it does not recognise, rather than passing it on.
const unknown = reduceTranscript(line({ type: 'brand_new_event_type', secret_field: 'C:\\Users\\Someone\\private' }));
expect('an unrecognised event type is dropped by default, not carried',
  unknown === '', JSON.stringify(unknown));

// claude-code and antigravity emit one result object, not an event stream.
const claude = reduceTranscript(line({ type: 'result', session_id: 's-123', uuid: 'u-9', total_cost_usd: 0.1, result: '## Review Complete\nI checked the gate.' }));
expect('a claude-code result reduces to its answer text',
  claude.includes('I checked the gate.') && !claude.includes('s-123') && !claude.includes('u-9'), claude);
const agy = reduceTranscript(line({ conversation_id: 'conv-7', status: 'done', response: 'The release review is complete.' }));
expect('an antigravity result reduces to its answer text',
  agy.includes('The release review is complete.') && !agy.includes('conv-7'), agy);

// A transcript that logged nothing reduces to nothing, and that is allowed —
// eval-verify requires the file to exist, not to be non-empty.
expect('an empty transcript reduces to empty', reduceTranscript('') === '');

// Reduction is idempotent: running it twice must not degrade the result,
// or a re-run of the corpus conversion would quietly eat evidence.
expect('reduction is idempotent', reduceTranscript(reduced) === reduced);

// IDEMPOTENCE, ON THE SHAPE THAT ACTUALLY BROKE. The assertion above passed
// while the reducer could not read its own `final` output, because the codex
// fixture it scores contains no final line. Running the reducer over the real
// corpus found it: 1,213 of 1,537 reduced files failed validation, and a
// second conversion pass would have deleted every answer text the first pass
// kept. A fixture agrees with its author; these two cases are the corpus's
// disagreement, written down.
for (const [harness, raw] of [
  ['claude-code', line({ type: 'result', session_id: 's-1', result: 'I checked the gate.' })],
  ['antigravity', line({ conversation_id: 'c-1', response: 'The review is complete.' })],
]) {
  const once = reduceTranscript(raw);
  expect(`${harness}: a final line survives a second reduction`,
    reduceTranscript(once) === once && once.includes('type":"final"'), JSON.stringify(once));
  expect(`${harness}: its reduced output validates as reduced`,
    isReducedTranscript(once), JSON.stringify(once));
}

// The manifest flag has to be checkable, or "reduced" is an unverified claim.
expect('isReducedTranscript accepts a reduced transcript', isReducedTranscript(reduced));
expect('isReducedTranscript rejects a full one', !isReducedTranscript(CODEX_RAW));
expect('isReducedTranscript rejects a smuggled identifier',
  !isReducedTranscript(line({ type: 'final', text: 'hi', session_id: 's-1' })));
expect('isReducedTranscript rejects an unparsable line', !isReducedTranscript('{not json\n'));
expect('isReducedTranscript accepts empty', isReducedTranscript(''));
