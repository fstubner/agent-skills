#!/usr/bin/env node
'use strict';
// Can someone who did not build this service run it?
//
// The suite covered getting code to production and nothing about it being
// there. This is the deterministic slice of that: an OPERATIONS.md with four
// sections that have real content, plus the two operability properties a
// repository can actually show — a health endpoint and structured logging.
//
// Deliberately NOT attempted: whether the alerts fire, whether the runbook
// is correct, whether the SLO is met. Those need a running system and a
// history, neither of which is in a checkout. Where this cannot tell, it
// reports not_evaluated rather than guessing — a missing answer must never
// read as a good one.
//
// Usage: node check-operability.js --root <dir> [--strict] [--out <file>] [--no-write]

const path = require('path');
const fs = require('fs');
const { corePaths } = require('./resolve-core.cjs');
const core = corePaths();
const { parseArgs } = require(path.join(core.lib, 'args.cjs'));
const { check, runCli, readText, sectionHasContent } = require(path.join(core.lib, 'report.cjs'));
const { classify } = require(path.join(core.lib, 'classify.cjs'));
const registry = require(core.registry);

const REQUIRED_SECTIONS = ['Signals', 'Alerts', 'Failure modes', 'Recovery'];
const SOURCE_EXT = /\.(c|m)?[jt]sx?$|\.(py|go|rb|rs|java)$/;

// A health or readiness endpoint under any of the usual spellings. This is
// the one operability affordance that is unambiguous in source: either a
// route answers "are you alive" or nothing does.
const HEALTH_ROUTE = /['"`]\/(healthz|health|readyz|ready|livez|live|_health|status)['"`]|\bhealth_?check\b|actuator\/health/i;

// Structured logging means fields, not a sentence. A logger library or a
// call carrying an object both count; a bare console.log does not, which is
// the distinction that decides whether an incident can be traced.
const STRUCTURED_LOGGER = /\b(pino|winston|bunyan|zerolog|logrus|structlog|slog|zap|serilog)\b/i;
// Either a logging call carrying fields, or JSON written to the log stream
// by hand. The second form was a false negative found on this suite's own
// fixture: `process.stdout.write(JSON.stringify({...}))` is structured
// logging by any definition that matters to an incident.
// The JSON may be wrapped — a template literal, a concatenation, a helper —
// so the match allows a short run of characters between the write and the
// serialisation rather than demanding they be adjacent. Adjacency was a
// false negative on this suite's own fixture the moment the newline moved
// into a template string.
const STRUCTURED_CALL = /\b(log|logger)\.(info|warn|error|debug)\s*\(\s*\{|(?:stdout|stderr)\.write\s*\([^)]{0,40}JSON\.stringify|\bconsole\.(log|info|warn|error)\s*\([^)]{0,40}JSON\.stringify/;
const BARE_CONSOLE = /\bconsole\.(log|error|warn)\s*\(/;

function sourceFiles(cls) {
  const out = [];
  for (let i = 0; i < cls.rel.length; i++) {
    if (!SOURCE_EXT.test(cls.rel[i])) continue;
    const text = cls.readFileSafe(i);
    if (text !== null) out.push({ rel: cls.rel[i], text });
  }
  return out;
}

function run(root) {
  const cls = classify(root, { evidenceDir: registry.evidenceDir });
  const checks = [];

  // Nothing runs, nothing to operate.
  if (!cls.serverPresent) {
    checks.push(check('O-scope', 'pass', 'no server detected; operability gate not required'));
    return checks;
  }

  const docPath = path.join(root, 'OPERATIONS.md');
  if (!fs.existsSync(docPath)) {
    checks.push(check('O-operations-doc', 'fail',
      'no OPERATIONS.md — a running service with no written signals, alerts, failure modes or recovery is operable only by whoever built it'));
    for (const section of REQUIRED_SECTIONS) {
      checks.push(check(`O-section-${section.toLowerCase().replace(/\s+/g, '-')}`, 'not_evaluated', 'no OPERATIONS.md to inspect'));
    }
  } else {
    const text = readText(docPath);
    checks.push(check('O-operations-doc', 'pass', 'OPERATIONS.md'));
    for (const section of REQUIRED_SECTIONS) {
      const id = `O-section-${section.toLowerCase().replace(/\s+/g, '-')}`;
      checks.push(sectionHasContent(text, section)
        ? check(id, 'pass', section)
        : check(id, 'fail', `OPERATIONS.md section "${section}" is missing or empty`));
    }
  }

  const files = sourceFiles(cls);
  if (files.length === 0) {
    checks.push(check('O-health-endpoint', 'not_evaluated', 'no readable source files to scan'));
    checks.push(check('O-structured-logs', 'not_evaluated', 'no readable source files to scan'));
    return checks;
  }

  const health = files.find((f) => HEALTH_ROUTE.test(f.text));
  checks.push(health
    ? check('O-health-endpoint', 'pass', `health/readiness route in ${health.rel}`)
    : check('O-health-endpoint', 'fail',
        'no health or readiness endpoint found; a deploy gate cannot observe health it cannot ask for'));

  const structured = files.find((f) => STRUCTURED_LOGGER.test(f.text) || STRUCTURED_CALL.test(f.text));
  const bareOnly = files.filter((f) => BARE_CONSOLE.test(f.text));
  if (structured) {
    checks.push(check('O-structured-logs', 'pass', `structured logging in ${structured.rel}`));
  } else if (bareOnly.length > 0) {
    checks.push(check('O-structured-logs', 'fail',
      `only unstructured console output found (e.g. ${bareOnly[0].rel}); an incident cannot be traced through prose`));
  } else {
    checks.push(check('O-structured-logs', 'not_evaluated',
      'no logging calls recognised; whether this service emits anything could not be determined from source'));
  }

  if (cls.truncated) {
    checks.push(check('O-scan-completeness', 'not_evaluated',
      'file walk hit the safety cap; endpoint and logging detection may be incomplete'));
  }
  return checks;
}

module.exports = { run };

if (require.main === module) {
  // Selected by id: this skill produces two reports.
  const artifact = registry.artifacts.find((a) => a.id === 'operability-report');
  runCli({
    skill: 'release-engineering',
    reportFile: path.basename(artifact.file),
    evidenceDir: registry.evidenceDir,
    runFn: run,
    argv: process.argv.slice(2),
    parseArgs,
  });
}
