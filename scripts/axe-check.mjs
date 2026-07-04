#!/usr/bin/env node
/**
 * axe accessibility audit on fragile-surfaces routes (Playwright + @axe-core/playwright).
 *
 * Usage:
 *   node axe-check.mjs --config ui-guardrails/fragile-surfaces.json --base-url http://localhost:PORT
 *
 * Exit 1 on any serious/critical violation. Requires npm install in ab-harness (or project).
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function findPlaywrightPkg(cwd) {
  for (const dir of [cwd, process.cwd(), path.join(skillRoot, 'ab-harness')]) {
    try {
      return {
        playwright: require(require.resolve('playwright', { paths: [dir] })),
        axeBuilder: require(require.resolve('@axe-core/playwright', { paths: [dir] })).default,
        dir,
      };
    } catch {
      /* next */
    }
  }
  return null;
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
  console.error('Usage: node axe-check.mjs --config <fragile-surfaces.json> --base-url http://localhost:PORT');
  process.exit(1);
}

const pkgs = findPlaywrightPkg(skillRoot);
if (!pkgs) {
  console.error('playwright + @axe-core/playwright not found — run: cd <skill>/ab-harness && npm install');
  process.exit(1);
}

const { chromium } = pkgs.playwright;
const AxeBuilder = pkgs.axeBuilder;
const config = JSON.parse(fs.readFileSync(args.config, 'utf8'));
const routes = config.surfaces?.length
  ? config.surfaces.map((s) => ({ id: s.id, path: s.path }))
  : [{ id: 'root', path: '/' }];

const seen = new Set();
const uniqueRoutes = routes.filter((r) => {
  if (seen.has(r.path)) return false;
  seen.add(r.path);
  return true;
});

console.log(`axe-check: ${uniqueRoutes.length} route(s), base ${args.baseUrl}`);

const browser = await chromium.launch();
const failed = [];

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  for (const route of uniqueRoutes) {
    const page = await context.newPage();
    const url = `${args.baseUrl.replace(/\/$/, '')}${route.path}`;
    await page.goto(url, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    if (serious.length) {
      failed.push({ id: route.id, path: route.path, violations: serious.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
      })) });
      console.log(`  FAIL axe ${route.id}: ${serious.length} serious/critical violation(s)`);
      for (const v of serious) {
        console.log(`    [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
        if (v.nodes[0]?.target) console.log(`      target: ${v.nodes[0].target.join(' ')}`);
      }
    } else {
      console.log(`  PASS axe ${route.id}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

if (failed.length) {
  console.log(`\naxe-check: ${failed.length} route(s) failed\n`);
  process.exit(1);
}
console.log('\naxe-check: all passed\n');
