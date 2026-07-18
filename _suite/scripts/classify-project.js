#!/usr/bin/env node
// Write suite-profile.json — shared classification for verification scripts.
// Usage: node classify-project.js [--root <dir>]

'use strict';

const path = require('path');
const { writeSuiteProfile } = require('../lib/classify-project.js');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(process.cwd(), String(args.root || '.'));
const { profile, outPath } = writeSuiteProfile(root);
console.log(`Wrote ${outPath}`);
console.log(`scopeTier: ${profile.scopeTier}  systemTier: ${profile.systemTier}  appTier: ${profile.appTier}  source: ${profile.source}`);
