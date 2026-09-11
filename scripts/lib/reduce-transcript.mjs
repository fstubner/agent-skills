// What a run bundle publishes about the model's turn, and nothing else.
//
// A harness transcript is a recording of a session on somebody's machine. It
// carries what the model did, and alongside it: the working directory, the
// shell, the skills installed on that machine, the account's plan tier, and
// whatever a command happened to print. Committed across hundreds of bundles
// to a public repository, the incidental half accumulates — on 2026-09-08 an
// audit found a username in 1,890 places, and the listing of a private host's
// tooling in 49 files.
//
// Deleting the transcripts would be the easy answer and the wrong one:
// eval/README.md names "complete raw transcript/output/cost bundles" as the
// thing the v2 evidence system exists to provide, and eval-verify refuses a
// bundle whose declared files are missing. So the bundle keeps a transcript;
// it keeps a smaller one.
//
// AN ALLOWLIST, NOT A DENYLIST. This is the property worth paying for: a
// harness that adds a field tomorrow cannot leak through it, because a field
// nobody named is not carried. A denylist inverts that — it is correct only
// until the next release, and wrong silently.
//
// WHAT SURVIVES, and why each earns its place:
//   - tool-call commands. The only machine check that reads a transcript is
//     the ambient-skill guard in eval-eligibility.mjs, which asks whether a
//     control arm reached for a skill installed on the machine. It reads
//     exactly these fields. Drop them and contamination stops being visible.
//   - the model's final answer text. Not duplicated in outputs/: it is what
//     the model said back, and comparing it against the artifact on disk is
//     how overclaiming is caught — a run that reports "I verified the runtime"
//     beside a report that evaluated nothing.
//   - agent messages, for the same reason, mid-turn.
//
// WHAT DOES NOT, and one that surprised me: `workdir` stays. It sits beside
// `command` in the same tool-call source and carries a scratch path. Stripping
// it was the plan until it was measured: it removes 12 of 31 path strings,
// because the other 19 are inside the command itself and are the contamination
// evidence. Twelve already-redacted folder names is not worth a permanent
// regex over JavaScript source whose failure mode is blinding the guard.
//
// Redaction still runs first. This narrows WHAT is published; redact-home
// cleans what remains. Neither replaces the other.
const IDENTIFIER_FIELDS = ['session_id', 'conversation_id', 'uuid', 'id', 'call_id'];

function finalText(event) {
  // claude-code and antigravity both emit a single result object rather than
  // an event stream; the model's answer is the only part worth keeping.
  if (typeof event.result === 'string' && event.result) return event.result;
  if (typeof event.response === 'string' && event.response) return event.response;
  return null;
}

// One event in, zero or one allowed shapes out. Returning null is the default
// for anything unrecognised — that is the allowlist doing its job.
function reduceEvent(event) {
  const payload = event.payload || event;
  const type = payload.type;

  if (type === 'custom_tool_call' && payload.input) {
    return { type, input: String(payload.input) };
  }
  if ((type === 'item.started' || type === 'item.completed')
    && payload.item && payload.item.type === 'command_execution') {
    return { type, item: { type: 'command_execution', command: String(payload.item.command || '') } };
  }
  if (type === 'agent_message' && payload.message) {
    return { type, message: String(payload.message) };
  }
  // The reducer's own `final` shape, recognised so that reducing an already
  // reduced transcript returns it unchanged. Without this clause the function
  // does not know its own output: isReducedTranscript rejected 1,213 of 1,537
  // reduced files, and a second conversion pass would have deleted every
  // answer text it had kept on the first. Caught by running the reducer over
  // the real corpus; the unit test missed it because the fixture I wrote
  // happened to contain no final line.
  if (type === 'final' && typeof payload.text === 'string') {
    return { type: 'final', text: payload.text };
  }
  const text = finalText(event);
  if (text) return { type: 'final', text };
  return null;
}

export function reduceTranscript(text) {
  if (!text) return '';
  const kept = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    // A line that does not parse is dropped rather than passed through: an
    // unparsable line is exactly the case where nobody can say what it holds.
    try { event = JSON.parse(line); } catch { continue; }
    const reduced = reduceEvent(event);
    if (reduced) kept.push(JSON.stringify(reduced));
  }
  return kept.length ? `${kept.join('\n')}\n` : '';
}

// Used by eval-verify: a reduced transcript must contain only shapes this
// module produces. Without it, "reduced" is a claim in the manifest that
// nothing checks, and a full transcript could be committed under the flag.
export function isReducedTranscript(text) {
  if (!text || !text.trim()) return true;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { return false; }
    const keys = Object.keys(event);
    if (keys.some((k) => IDENTIFIER_FIELDS.includes(k))) return false;
    const shape = reduceEvent(event);
    if (!shape) return false;
    if (JSON.stringify(shape) !== JSON.stringify(event)) return false;
  }
  return true;
}
