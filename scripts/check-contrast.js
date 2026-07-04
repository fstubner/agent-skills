#!/usr/bin/env node
// Check WCAG contrast between a text color and a background color.
// Usage: node check-contrast.js "#TEXT" "#BACKGROUND" [--large] [--ui]
//   (default gate) AA normal text, must reach 4.5:1
//   --large        gate at 3.0:1 (text >=24px, or >=18.66px bold)
//   --ui           gate at 3.0:1 (UI components, icons, graphics — WCAG 1.4.11)
// Exit code: 0 if it meets the active gate, 1 otherwise (or on bad input).

'use strict';

const { contrastRatio } = require('./color-utils');

// Contrast over a translucent color depends on what's behind it, which a CLI can't
// know. Strip the alpha channel, compute on the opaque RGB, and warn the user.
function stripAlpha(input) {
  if (typeof input !== 'string') return { value: input, hadAlpha: false };
  const h = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{4}$/.test(h)) return { value: `#${h.slice(0, 3)}`, hadAlpha: true };
  if (/^[0-9a-fA-F]{8}$/.test(h)) return { value: `#${h.slice(0, 6)}`, hadAlpha: true };
  return { value: input, hadAlpha: false };
}

function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const [rawFg, rawBg] = argv.filter((a) => !a.startsWith('--'));
  if (!rawFg || !rawBg) {
    console.error('Usage: node check-contrast.js "#TEXT" "#BACKGROUND" [--large] [--ui]');
    process.exit(1);
  }

  const large = flags.has('--large');
  const ui = flags.has('--ui');
  const gate = large || ui ? 3.0 : 4.5;
  const gateLabel = ui ? 'AA UI / graphics (>=3.0)'
    : large ? 'AA large text (>=3.0)'
      : 'AA normal text (>=4.5)';

  const fg = stripAlpha(rawFg);
  const bg = stripAlpha(rawBg);
  if (fg.hadAlpha || bg.hadAlpha) {
    console.error('Note: alpha channel ignored. Contrast over a translucent color depends on the');
    console.error('backdrop behind it — test against the actual composited color.');
  }

  let ratio;
  try {
    ratio = contrastRatio(fg.value, bg.value);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }

  const r = Math.round(ratio * 100) / 100;
  const checks = [
    ['AA  normal text  (>=4.5)', ratio >= 4.5],
    ['AA  large text   (>=3.0)', ratio >= 3.0],
    ['AA  UI / graphics(>=3.0)', ratio >= 3.0],
    ['AAA normal text  (>=7.0)', ratio >= 7.0],
    ['AAA large text   (>=4.5)', ratio >= 4.5],
  ];

  console.log(`\nContrast: ${fg.value} on ${bg.value}  ->  ${r}:1`);
  console.log(`Gate: ${gateLabel}\n`);
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}`);
  }

  const passed = ratio >= gate;
  if (passed) {
    console.log(`\nPasses the active gate (${gateLabel}).`);
  } else {
    console.log(`\nFails the active gate (${gateLabel}). Pick a different token and re-check.`);
    if (!large && !ui && ratio >= 3.0) {
      console.log('(Would pass for large text >=24px or >=18.66px bold — re-run with --large.)');
    }
  }
  process.exit(passed ? 0 : 1);
}

main();
