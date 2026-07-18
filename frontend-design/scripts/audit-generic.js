#!/usr/bin/env node
// Flag "generic SaaS template" smells in CSS + optional design-tokens.json.
// Register-aware: brand/editorial and component-tier skip product-shell chrome checks.
//
// Usage:
//   node audit-generic.js <styles.css> [design-tokens.json] [--root .]

'use strict';

const fs = require('fs');
const path = require('path');
const { loadProjectContext, isComponentCssFile } = require('./lib-context.cjs');

function parseArgs(argv) {
  const out = { cssPath: null, tokensPath: null, root: process.cwd() };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') out.root = path.resolve(argv[++i]);
    else positional.push(a);
  }
  out.cssPath = positional[0];
  out.tokensPath = positional[1];
  return out;
}

function readFile(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    console.error(`Cannot read ${p}: ${e.message}`);
    process.exit(1);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.cssPath) {
    console.error('Usage: node audit-generic.js <styles.css> [design-tokens.json] [--root .]');
    process.exit(1);
  }

  const cssPath = path.resolve(args.cssPath);
  const css = readFile(cssPath);
  const ctx = loadProjectContext(args.root);
  const componentFile = isComponentCssFile(cssPath);
  const productShell = ctx.register === 'product' && ctx.shell !== 'none' && !componentFile
    && (ctx.scopeTier === 'app' || ctx.scopeTier === 'page' && ctx.shell === 'sidebar');
  const brandSurface = ctx.register === 'brand' || ctx.archetype === 'editorial' || ctx.shell === 'none';

  const findings = [];

  if (/font-family:\s*system-ui/i.test(css) && !/font-sans|IBM Plex|Jakarta|Source Sans|Fraunces|var\(--font/i.test(css)) {
    findings.push('system-ui as primary font — load archetype fonts from meta.fontsUrl');
  }

  if (productShell) {
    if (!/--chrome-bg|var\(--chrome-bg\)/.test(css)) {
      findings.push('no chrome-bg usage — chrome and content likely same flat plane');
    }
    if (!/--content-well|var\(--content-well\)/.test(css)) {
      findings.push('no content-well usage — main area may not separate from chrome');
    }
  }

  if (brandSurface && !componentFile) {
    if (!/--font-display|var\(--font-display\)/.test(css) && /hero|display|headline|title/i.test(css)) {
      findings.push('editorial/brand page without font-display — use display type for hero hierarchy');
    }
    if (!/--accent|var\(--accent\)/.test(css)) {
      findings.push('no accent token usage — brand pages need deliberate accent roles');
    }
    const accentUses = (css.match(/var\(--accent\)/g) || []).length;
    if (accentUses > 0 && accentUses < 2) {
      findings.push('accent used in only one role — apply accent to ≥2 roles (CTA, labels, focus)');
    }
  }

  if (!/--font-mono|var\(--font-mono\)/.test(css) && /\.session|\.metric|\.data-/i.test(css)) {
    findings.push('data/session rows without font-mono — missed craft opportunity');
  }
  if (!/--accent-subtle|var\(--accent-subtle\)/.test(css) && /\.empty-state/i.test(css)) {
    findings.push('empty state without accent-subtle wash');
  }
  if (/#2563eb/i.test(css)) {
    findings.push('hardcoded #2563eb — use var(--accent)');
  }

  let tokens = null;
  if (args.tokensPath) {
    try {
      tokens = JSON.parse(readFile(path.resolve(args.tokensPath)));
    } catch {
      tokens = null;
    }
  } else if (ctx.tokens) {
    tokens = ctx.tokens;
  }

  if (tokens) {
    const sans = tokens.type?.['font-sans'] || '';
    if (/^system-ui/i.test(sans.trim())) {
      findings.push('token font-sans is still system-ui — re-run init-design-tokens.js');
    }
    if (!tokens.meta?.fontsUrl && !componentFile) {
      findings.push('tokens missing meta.fontsUrl');
    }
    if (productShell && !tokens.color?.['chrome-bg']) {
      findings.push('tokens missing chrome-* colors');
    }
    if (ctx.shell === 'none' && tokens.layout?.['sidebar-width']) {
      findings.push('shell is none but tokens include sidebar-width — re-run init-design-tokens.js --shell none');
    }
  }

  const score = findings.length;
  const mode = componentFile ? 'component' : brandSurface ? 'brand/editorial' : productShell ? 'product-shell' : 'generic';
  console.log(`\nGeneric SaaS audit: ${cssPath} (${mode})`);
  if (!findings.length) {
    console.log('  Score: 0 — no generic tells detected.\n');
    process.exit(0);
  }
  for (const f of findings) {
    console.log(`  • ${f}`);
  }
  console.log(`\nScore: ${score} (target ≤2 for full pages; fix or justify each)\n`);
  process.exit(0);
}

main();
