#!/usr/bin/env node
// SessionStart hook: injects routing/routing.md — a trigger-to-skill table —
// into every session.
//
// This exists because skill descriptions do not cause invocation. Measured:
// five unprimed runs, skills installed and visible (a subagent asked to list
// its own tools reported all 17, namespaced), prompts matching the skills'
// own stated triggers — zero invocations. A description rewritten to quote
// the user's literal phrasing scored the same zero. See
// eval/results/invocation-description-ab-2026-08-02.md.
//
// The mechanism that demonstrably fires is text injected every session, not
// text the model has to go looking for. concise-style/ already proves that
// shape works; this applies it to routing.
//
// Prints to stdout, which Claude Code injects as session context. Exits 0
// unconditionally and says nothing if the file is missing — a routing hint
// must never be able to break a session, and one that can is one that gets
// uninstalled.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROUTING_FILE = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  'routing',
  'routing.md',
);

function main() {
  // SessionStart fires on startup, resume and compaction; the routing applies
  // to all three, so there is nothing to branch on. stdin is drained anyway so
  // the writer never blocks on a full pipe.
  try {
    fs.readFileSync(0, 'utf8');
  } catch {
    /* no stdin is fine */
  }

  let text;
  try {
    text = fs.readFileSync(ROUTING_FILE, 'utf8');
  } catch {
    return; // Missing file: say nothing rather than emit a broken hint.
  }

  // UTF-8 or the table borders and em dashes become mojibake on a Windows
  // console, whose default is the locale codepage. This is the failure that
  // silently killed a SessionStart hook on this machine once already:
  // UnicodeEncodeError, no output, no error surfaced.
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
