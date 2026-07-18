#!/usr/bin/env node
/**
 * Run layout invariant checks from ui-guardrails/fragile-surfaces.json.
 *
 * Usage:
 *   node layout-check.mjs --config ui-guardrails/fragile-surfaces.json --base-url http://localhost:PORT
 *
 * Requires playwright (install in project or: cd ab-harness && npm install).
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { runLayoutSuite } from './layout-assert.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function loadChromium() {
  const candidates = [process.cwd(), path.join(skillRoot, 'ab-harness')];
  for (const dir of candidates) {
    try {
      const pw = require(require.resolve('playwright', { paths: [dir] }));
      return pw.chromium;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'playwright not found — run: cd <skill>/ab-harness && npm install (or npm install -D playwright in project)',
  );
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--config') out.config = path.resolve(argv[++i]);
    else if (a === '--base-url') out.baseUrl = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.config || !args.baseUrl) {
  console.error('Usage: node layout-check.mjs --config <fragile-surfaces.json> --base-url http://localhost:PORT');
  process.exit(1);
}

if (!fs.existsSync(args.config)) {
  console.error(`Config not found: ${args.config}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(args.config, 'utf8'));
const layoutSurfaces = (config.surfaces || []).filter((s) => s.layout);
if (!layoutSurfaces.length) {
  console.log('layout-check: no surfaces with layout:true — skipping');
  process.exit(0);
}

console.log(`layout-check: ${layoutSurfaces.length} surface(s), base ${args.baseUrl}`);

const chromium = loadChromium();
const browser = await chromium.launch();
try {
  const { failed } = await runLayoutSuite(browser, args.baseUrl, config);
  if (failed.length) {
    console.log(`\nlayout-check: ${failed.length} failed\n`);
    process.exit(1);
  }
  console.log('\nlayout-check: all passed\n');
} finally {
  await browser.close();
}
