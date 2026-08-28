#!/usr/bin/env node
// Turns the Replay block of a ux-walkthrough.md into a runnable Playwright
// spec, so the walk an agent or a person did once becomes something a
// machine repeats for free.
//
// This does NOT run anything. The suite executes no target-project code
// anywhere (see SECURITY.md), and driving a browser against the product is
// emphatically that. It writes a spec; you run it; acceptance reads the log.
//
// The prose steps stay prose — they are what a human reads and what carries
// the judgment steps no assertion covers. The Replay block is the subset
// that can be checked mechanically, and a walkthrough with no Replay block
// is not an error, only an unautomated walkthrough.
//
// Usage:
//   node gen-walkthrough-spec.mjs --root <dir> [--out <file>] [--print-hash]

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
};

const root = path.resolve(valueAfter('--root') || '.');
const source = path.join(root, 'ux-walkthrough.md');
if (!fs.existsSync(source)) {
  console.error(`no ux-walkthrough.md at ${root}`);
  process.exit(2);
}

// The Replay block is a fenced ```walkthrough section. Each step is one
// `- do: ...` with an optional `expect:`. Deliberately a tiny grammar: an
// expressive one would need a parser nobody would trust, and the point is
// that a reader can see exactly what will be executed.
//
//   ```walkthrough
//   - goto: /
//     expect: text "Sign in"
//   - fill: #staffId = nurse-a
//     click: #signin
//     expect: text "No notes for this shift yet"
//   ```
const REPLAY_BLOCK = /```walkthrough\s*\n([\s\S]*?)```/;

function parseReplay(markdown) {
  const block = REPLAY_BLOCK.exec(markdown);
  if (!block) return null;
  const steps = [];
  let current = null;
  for (const rawLine of block[1].split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const started = /^-\s*(.*)$/.exec(line);
    const body = started ? started[1] : line;
    if (started) {
      current = { actions: [], expects: [] };
      steps.push(current);
    }
    if (!current) continue;
    const pair = /^(goto|click|fill|press|expect)\s*:\s*(.+)$/i.exec(body);
    if (!pair) continue;
    const [, verb, rest] = pair;
    if (verb.toLowerCase() === 'expect') current.expects.push(rest.trim());
    else current.actions.push({ verb: verb.toLowerCase(), arg: rest.trim() });
  }
  return steps.filter((s) => s.actions.length || s.expects.length);
}

function emitAction({ verb, arg }) {
  if (verb === 'goto') return `  await page.goto(${JSON.stringify(arg)});`;
  if (verb === 'click') return `  await page.click(${JSON.stringify(arg)});`;
  if (verb === 'press') {
    const [selector, key] = arg.split('=').map((s) => s.trim());
    return `  await page.press(${JSON.stringify(selector)}, ${JSON.stringify(key || 'Enter')});`;
  }
  if (verb === 'fill') {
    const [selector, value] = arg.split('=').map((s) => s.trim());
    return `  await page.fill(${JSON.stringify(selector)}, ${JSON.stringify(value || '')});`;
  }
  return `  // unsupported action: ${verb}`;
}

function emitExpect(expression) {
  const text = /^text\s+"([^"]*)"$/i.exec(expression);
  if (text) return `  await expect(page.getByText(${JSON.stringify(text[1])})).toBeVisible();`;
  const visible = /^visible\s+(.+)$/i.exec(expression);
  if (visible) return `  await expect(page.locator(${JSON.stringify(visible[1].trim())})).toBeVisible();`;
  const url = /^url\s+(.+)$/i.exec(expression);
  if (url) return `  await expect(page).toHaveURL(${JSON.stringify(url[1].trim())});`;
  return `  // unsupported expectation: ${expression}`;
}

const markdown = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n');
const steps = parseReplay(markdown);
if (!steps || steps.length === 0) {
  console.error('ux-walkthrough.md has no ```walkthrough replay block; nothing to generate');
  process.exit(3);
}

const body = steps.map((step, index) => {
  const lines = [
    ...step.actions.map(emitAction),
    ...step.expects.map(emitExpect),
  ].join('\n');
  return `test(${JSON.stringify(`walkthrough step ${index + 1}`)}, async ({ page }) => {\n${lines}\n});`;
}).join('\n\n');

const spec = `// GENERATED from ux-walkthrough.md — do not edit.
// Regenerate: node <product-acceptance>/scripts/gen-walkthrough-spec.mjs --root .
//
// Run it, then point acceptance at the log:
//   npx playwright test walkthrough.spec.js --reporter=json > .agent-evidence/walkthrough-run.json
//
// The log records the hash below. Acceptance regenerates this spec and
// compares, so a log from before the walkthrough changed reads as stale
// rather than as evidence.
import { test, expect } from '@playwright/test';

${body}
`;

const specHash = crypto.createHash('sha256').update(spec).digest('hex');
if (args.includes('--print-hash')) {
  console.log(specHash);
  process.exit(0);
}

const outPath = path.resolve(valueAfter('--out') || path.join(root, 'walkthrough.spec.js'));
fs.writeFileSync(outPath, `${spec}// specSha256: ${specHash}\n`);
console.log(JSON.stringify({
  source: path.relative(root, source),
  spec: path.relative(root, outPath),
  steps: steps.length,
  specSha256: specHash,
}, null, 2));
