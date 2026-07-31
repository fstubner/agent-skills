#!/usr/bin/env node
// SessionStart hook: injects output-style/concise.md into every session.
//
// Why a hook and not a skill: this suite measured ~0% unprompted skill
// invocation (eval/results/). A response-style rule has to be always-on —
// it governs every response, including the ones where nothing would prompt
// the model to reach for a skill.
//
// Why a hook and not an output style: Claude Code's output-style feature is
// deprecated. Anthropic's own explanatory-output-style plugin recreates it
// as a SessionStart hook, which is also the direct evidence this mechanism
// works — that plugin measurably changed this assistant's behaviour for a
// whole session while installed skills did not.
//
// Prints the file to stdout, which Claude Code injects as session context.
// Exits 0 unconditionally: a style preference must never be able to break a
// session, and a hook that can is a hook that gets uninstalled.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const STYLE_FILE = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  'output-style',
  'concise.md',
);

function main() {
  // The payload is read and discarded. SessionStart fires on startup, resume,
  // and compaction; the rules apply to all three, so there is nothing to
  // branch on — but stdin is drained anyway so the writer never blocks on a
  // full pipe.
  try {
    fs.readFileSync(0, 'utf8');
  } catch {
    /* no stdin is fine */
  }

  let text;
  try {
    text = fs.readFileSync(STYLE_FILE, 'utf8');
  } catch {
    return; // Missing style file: say nothing rather than emit a broken rule.
  }

  // stdout must be UTF-8 or the em dashes and table borders below become
  // mojibake on a Windows console, whose default is the locale codepage.
  // (Exactly the bug that silently killed the harness-dispatch SessionStart
  // hook on this machine: UnicodeEncodeError, no output, no error surfaced.)
  try {
    process.stdout.setDefaultEncoding('utf8');
  } catch {
    /* older runtimes: best effort */
  }

  process.stdout.write(text.endsWith('\n') ? text : text + '\n');
}

try {
  main();
} catch {
  /* deliberately swallowed — see header */
}
process.exit(0);
