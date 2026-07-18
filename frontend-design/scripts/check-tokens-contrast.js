#!/usr/bin/env node
// Verify WCAG AA contrast for all semantic text/status pairs in design-tokens.json
// against the surfaces they actually render on (base + raised).
//
// Usage: node check-tokens-contrast.js [design-tokens.json]
// Exit 0 if all pairs pass 4.5:1, 1 otherwise.

'use strict';

const fs = require('fs');
const path = require('path');
const { contrastRatio } = require('./color-utils');

const AA = 4.5;

function main() {
  const inPath = path.resolve(process.cwd(), process.argv[2] || 'design-tokens.json');
  let tokens;
  try {
    tokens = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  } catch (e) {
    console.error(`Cannot read ${inPath}: ${e.message}`);
    process.exit(1);
  }

  const c = tokens.color;
  if (!c) {
    console.error('No color group in tokens file.');
    process.exit(1);
  }

  const base = c['surface-base'];
  const raised = c['surface-raised'];
  if (!base || !raised) {
    console.error('Missing surface-base or surface-raised in color tokens.');
    process.exit(1);
  }

  const pairs = [
    ['text-main', c['text-main'], base, 'body on base'],
    ['text-main', c['text-main'], raised, 'body on raised'],
    ['text-muted', c['text-muted'], base, 'muted on base'],
    ['text-muted', c['text-muted'], raised, 'muted on raised'],
    ['text-on-accent', c['text-on-accent'], c.accent, 'on accent button'],
    ['success', c.success, base, 'status on base'],
    ['success', c.success, raised, 'status on raised'],
    ['warning', c.warning, base, 'status on base'],
    ['warning', c.warning, raised, 'status on raised'],
    ['danger', c.danger, base, 'status on base'],
    ['danger', c.danger, raised, 'status on raised'],
    ['info', c.info, base, 'status on base'],
    ['info', c.info, raised, 'status on raised'],
  ].filter(([, fg]) => fg);

  if (c['chrome-bg'] && c['chrome-text']) {
    pairs.push(['chrome-text', c['chrome-text'], c['chrome-bg'], 'nav on chrome']);
  }
  if (c['chrome-bg'] && c['chrome-text-muted']) {
    pairs.push(['chrome-text-muted', c['chrome-text-muted'], c['chrome-bg'], 'muted nav on chrome']);
  }
  if (c['content-well'] && c['text-main']) {
    pairs.push(['text-main', c['text-main'], c['content-well'], 'body on content-well']);
  }

  console.log(`\nToken contrast audit: ${inPath}`);
  console.log(`Target: WCAG AA ${AA}:1 for normal text\n`);

  let failed = 0;
  for (const [name, fg, bg, label] of pairs) {
    let ratio;
    try {
      ratio = contrastRatio(fg, bg);
    } catch (e) {
      console.log(`  ERR   ${name} ${label}: ${e.message}`);
      failed++;
      continue;
    }
    const r = Math.round(ratio * 100) / 100;
    const pass = ratio >= AA;
    if (!pass) failed++;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name} ${label}: ${fg} on ${bg} = ${r}:1`);
  }

  console.log(failed ? `\n${failed} pair(s) failed. Adjust tokens and re-run.\n` : '\nAll pairs pass.\n');
  process.exit(failed ? 1 : 0);
}

main();
