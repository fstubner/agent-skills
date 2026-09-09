// Keep the machine that ran an eval out of the evidence it produces.
//
// A harness records its own working directory, and those directories live
// under a home folder named after a person. Committed to a public repository
// across hundreds of bundles, that published a username 951 times before
// anyone looked — found by an audit on 2026-09-08 and redacted the same day.
//
// Applied to the captured text (transcript, stderr, grader output) as it is
// written, never to outputs/. The workspace tree is hash-bound: rewriting a
// byte there would break the artifactSha256 that makes the bundle evidence.
// The captured text is bound by nothing, which is exactly why it can be
// cleaned and the workspace cannot.
//
// os.homedir() rather than a fixed name, so this keeps working for anyone
// else who runs the programme, and both separators are covered because
// harness output mixes them freely — including the JSON-escaped form that
// appears inside transcript.jsonl.
import os from 'os';

const PLACEHOLDER = '<home>';

export function redactHome(text, home = os.homedir()) {
  if (!text || !home) return text;
  const backslash = home.replace(/\//g, '\\');
  const forward = home.replace(/\\/g, '/');
  const escaped = backslash.replace(/\\/g, '\\\\');
  let out = text;
  // Longest first: the JSON-escaped form contains neither of the others as a
  // substring, but replacing the plain backslash form first would leave half
  // an escape behind in a transcript.
  for (const form of [escaped, backslash, forward]) {
    if (form) out = out.split(form).join(PLACEHOLDER);
  }
  return out;
}
