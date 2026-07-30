#!/usr/bin/env node
// Appends one line per Skill-tool invocation to a local, gitignored log.
//
// Why a hook and not a skill: this suite measured ~0% spontaneous skill
// invocation across two unprimed runs (see eval/results/). A telemetry
// *skill* would inherit exactly that problem — it would only record the
// sessions where the model remembered to record, which is the same
// selection bias that makes the question unanswerable. A PostToolUse hook
// fires unconditionally, so the denominator is real.
//
// Reads the hook payload as JSON on stdin. Writes to
// <cwd>/.agent-skills-telemetry/invocations.jsonl — per-project, because
// "which project was this" is half the signal.
//
// Fails silently and always exits 0. A telemetry hook that can break a
// session, or block a tool call because a disk write failed, is worse than
// no telemetry: it would get uninstalled, and take the measurement with it.

import fs from 'fs';
import path from 'path';

const LOG_DIR = '.agent-skills-telemetry';
const LOG_FILE = 'invocations.jsonl';

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

// The payload shape is set by the harness, not by us, and has changed
// before. Pull the skill name from any of the plausible locations rather
// than hard-failing on one — an unrecognised shape still logs a row with
// skill: null, which is honest and still counts the invocation.
function skillNameFrom(payload) {
  const input = payload.tool_input || payload.toolInput || {};
  return input.skill || input.name || input.skill_name || payload.skill || null;
}

function main() {
  const raw = readStdin();
  if (!raw.trim()) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  // PostToolUse can be configured with a matcher, but don't rely on the
  // caller having done so — a mis-scoped matcher would otherwise log every
  // Read and Bash call and drown the signal.
  const toolName = payload.tool_name || payload.toolName || '';
  if (toolName !== 'Skill') return;

  const cwd = payload.cwd || process.cwd();
  const row = {
    at: new Date().toISOString(),
    skill: skillNameFrom(payload),
    project: path.basename(cwd),
    cwd,
    session: payload.session_id || payload.sessionId || null,
  };

  try {
    const dir = path.join(cwd, LOG_DIR);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, LOG_FILE), JSON.stringify(row) + '\n');
  } catch {
    // Deliberately swallowed — see the header.
  }
}

try {
  main();
} catch {
  // Deliberately swallowed — see the header.
}
process.exit(0);
