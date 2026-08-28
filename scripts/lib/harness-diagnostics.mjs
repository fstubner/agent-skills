// Harness-level diagnostics ONLY — never the model's own words.
//
// The first version of this concatenated raw stdout, and for a JSON-stream
// harness stdout *contains the model's output*. A perfectly good codex run
// whose assessment recommended adding "rate limiting" was matched by the
// rate-limit pattern below and discarded as an environment failure, which
// then aborted a 54-run cohort on a false signal. Measured 2026-08-28.
//
// So: stderr and spawn errors are diagnostics. Structured events count only
// when the harness itself reports the failure — codex `type: "error"` or
// `turn.failed`, agy's top-level `status`/`error`, claude's `is_error`
// envelope. Assistant text is never evidence about the harness.
export function harnessDiagnostics(result) {
  const parts = [result.stderr || '', result.error?.message || ''];
  const stdout = result.stdout || '';
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let event;
    try { event = JSON.parse(trimmed); } catch { continue; }
    if (event.type === 'error' || event.type === 'turn.failed') {
      parts.push(typeof event.message === 'string' ? event.message : JSON.stringify(event.error || ''));
    }
    // agy and claude emit a single envelope rather than a stream.
    if (event.status && event.status !== 'SUCCESS') parts.push(`${event.status}: ${event.error || ''}`);
    if (event.is_error === true) parts.push(String(event.result || event.error || 'harness reported is_error'));
  }
  return parts.join('\n');
}
