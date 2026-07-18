#!/usr/bin/env node
// Emit a design-tokens.json contract as consumable CSS: either plain custom
// properties (works in any stack) or a Tailwind v4 @theme block.
//
// Usage:
//   node tokens-to-css.js [tokens.json] [--format css|tailwind] [--selector ":root"] [--theme light|dark] [--out file]
//
// Defaults: tokens file = ./design-tokens.json, format = css, selector = :root,
// output = stdout. Closes the loop from init-design-tokens.js (generate) to the
// stylesheet the components actually consume (no hand-written var mapping to drift).
//
// CSS custom properties are universal: vanilla CSS, CSS-in-JS via var(), Sass, and
// Tailwind v4 (which reads var() and theme tokens). The Tailwind output is a starting
// point — verify namespaces against your installed Tailwind version (see resources.md).

'use strict';

const fs = require('fs');
const path = require('path');

// Order groups for stable, readable output. `meta` is documentation, not styling.
const GROUP_ORDER = ['color', 'space', 'radius', 'shadow', 'type', 'layout', 'motion'];

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { out[key] = true; }
      else { out[key] = next; i++; }
    } else {
      out._.push(a);
    }
  }
  return out;
}

// Tailwind v4 maps theme variables to utilities by namespace. Most of our token
// names already carry a compatible prefix (radius-, shadow-, font-, text-, leading-,
// tracking-, duration-, ease-); only colors and spacing need a rename.
function tailwindName(group, name) {
  if (group === 'color') return `color-${name}`;          // -> bg-*/text-*/border-*
  if (group === 'space') return name.replace(/^space-/, 'spacing-'); // -> p-*/m-*/gap-*
  return name; // radius/shadow/type/motion names already match v4 namespaces
}

function emitCss(tokens, selector) {
  const lines = [`${selector} {`];
  for (const group of GROUP_ORDER) {
    const entries = tokens[group];
    if (!entries || typeof entries !== 'object') continue;
    lines.push(`  /* ${group} */`);
    for (const [name, value] of Object.entries(entries)) {
      lines.push(`  --${name}: ${value};`);
    }
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

function emitTailwind(tokens) {
  const header = [
    '/* Tailwind v4 theme. Import your CSS, then `@import "tailwindcss";` above this.',
    '   Starting point — verify namespaces against your Tailwind version (resources.md).',
    '   Duration tokens are exposed as variables; use via var() or duration-[…] if your',
    '   version does not generate duration utilities from them. */',
  ].join('\n');
  const lines = [header, '@theme {'];
  for (const group of GROUP_ORDER) {
    const entries = tokens[group];
    if (!entries || typeof entries !== 'object') continue;
    lines.push(`  /* ${group} */`);
    for (const [name, value] of Object.entries(entries)) {
      lines.push(`  --${tailwindName(group, name)}: ${value};`);
    }
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

function resolveSelector(args) {
  if (args.theme) {
    const theme = String(args.theme).toLowerCase();
    if (theme === 'dark') return '[data-theme="dark"]';
    if (theme === 'light') return ':root';
    console.error(`Unknown theme "${args.theme}". Use: light | dark`);
    process.exit(1);
  }
  return String(args.selector || ':root');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = path.resolve(process.cwd(), String(args._[0] || 'design-tokens.json'));
  const format = String(args.format || 'css').toLowerCase();
  const selector = resolveSelector(args);

  if (format !== 'css' && format !== 'tailwind') {
    console.error(`Unknown format "${format}". Use: css | tailwind`);
    process.exit(1);
  }

  let tokens;
  try {
    tokens = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  } catch (e) {
    console.error(`Cannot read tokens from ${inPath}: ${e.message}`);
    console.error('Generate one first: node scripts/init-design-tokens.js --archetype consumer --brand "#2563eb"');
    process.exit(1);
  }
  if (!tokens || typeof tokens !== 'object') {
    console.error('Tokens file is not a JSON object.');
    process.exit(1);
  }
  const hasAnyGroup = GROUP_ORDER.some((g) => tokens[g] && typeof tokens[g] === 'object');
  if (!hasAnyGroup) {
    console.error(`No known token groups (${GROUP_ORDER.join(', ')}) found in ${inPath}.`);
    process.exit(1);
  }

  const css = format === 'tailwind' ? emitTailwind(tokens) : emitCss(tokens, selector);

  if (args.out) {
    const outPath = path.resolve(process.cwd(), String(args.out));
    fs.writeFileSync(outPath, css);
    console.error(`Wrote ${outPath} (${format}).`);
  } else {
    process.stdout.write(css);
  }
}

main();
