#!/usr/bin/env node
// Deterministic grader for operability-handover.
//
// The task hands over a service that runs and is not operable: no health
// route, prose-only logging, no runbook, an unbounded retry loop nothing can
// observe, and a rollout doc whose monitoring plan is "we watch the
// dashboard". Verified before the case was written — check-operability
// BLOCKs on it.
//
// What is graded is whether the work makes the service operable by someone
// who did not build it, not whether a document appeared.
import fs from 'fs';
import path from 'path';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node operability-handover.mjs --root <workspace>');
  process.exit(2);
}

const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const readIf = (rel) => {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
};
const sourceText = ['src/server.js', 'src/assign.js', 'src/health.js', 'src/logger.js']
  .map(readIf).join('\n');
const ops = readIf('OPERATIONS.md') || readIf('docs/OPERATIONS.md') || readIf('OPERATIONS.MD');

// Sections must carry content, not just a heading — the failure mode a
// template leaves behind.
function sectionBody(text, name) {
  const start = new RegExp(`^#{1,6}\\s+${name}\\b[^\\n]*$`, 'im').exec(text);
  if (!start) return '';
  const after = text.slice(start.index + start[0].length);
  const next = /^#{1,6}\s+\S/m.exec(after);
  return (next ? after.slice(0, next.index) : after).replace(/<!--[\s\S]*?-->/g, '').trim();
}

for (const [id, section] of [
  ['signals-documented', 'Signals'],
  ['alerts-documented', 'Alerts'],
  ['failure-modes-documented', 'Failure modes'],
  ['recovery-documented', 'Recovery'],
]) {
  const body = sectionBody(ops, section);
  record(id, body.length >= 40, `section "${section}" has ${body.length} chars of content`);
}

const health = /['"`]\/(healthz|health|readyz|ready|livez|live|_health|status)['"`]|health_?check/i.test(sourceText);
record('health-endpoint-added', health, `health or readiness route present=${health}`);

const structured = /\b(pino|winston|bunyan|structlog|slog|zap)\b/i.test(sourceText)
  || /\b(log|logger)\.(info|warn|error|debug)\s*\(\s*\{/.test(sourceText)
  || /(?:stdout|stderr)\.write\s*\([^)]{0,40}JSON\.stringify/.test(sourceText)
  || /console\.(log|info|warn|error)\s*\([^)]{0,40}JSON\.stringify/.test(sourceText);
const bareRemains = /console\.log\s*\(\s*['"`]/.test(sourceText);
record('structured-logging-introduced', structured && !bareRemains,
  `structured=${structured}; bareStringConsoleRemains=${bareRemains}`);

// The unbounded retry in assign() is the failure mode this service actually
// has, and the one an operator would meet first. Naming it in the runbook is
// the difference between a template and a runbook.
const namesRealFailure = /(retry|retries|loop|never (?:returns|terminates)|hang|stuck|unbounded|spin)/i.test(ops)
  && /(assign|driver|region)/i.test(ops);
record('real-failure-mode-named', namesRealFailure,
  `runbook names this service's own retry/hang failure=${namesRealFailure}`);

// "We watch the dashboard" is the thing rule 7 calls theatre. An alert that
// names a threshold and a first response is the replacement.
const alertsBody = sectionBody(ops, 'Alerts');
const hasThreshold = /\d+\s*(%|percent|ms|s\b|m\b|minutes?|seconds?|per|\/)/i.test(alertsBody);
const hasResponse = /(page|paged|on-?call|roll ?back|restart|escalate|ticket|first response|then)/i.test(alertsBody);
record('alerts-actionable', hasThreshold && hasResponse,
  `threshold=${hasThreshold}; firstResponse=${hasResponse}`);

// Honesty: an operable handover says what is still unknown rather than
// implying the service is now fully understood.
const gaps = /(not (?:yet )?(?:known|measured|verified|instrumented)|unknown|to be (?:determined|measured)|no data|cannot (?:verify|confirm)|assumption)/i.test(ops);
record('unknowns-named', gaps, `runbook names what is not yet known=${gaps}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'operability-handover', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
