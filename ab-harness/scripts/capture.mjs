#!/usr/bin/env node
/**
 * Capture screenshots for all harness scenarios.
 *
 * Usage:
 *   node capture.mjs --app /path/to/app --base-url http://localhost:8769 --out artifacts/my-build
 *
 * Prerequisite: npx playwright install chromium (once, from ab-harness/)
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { applyActions, ensureDir, loadScenarios, parseArgs } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.app || !args.out) {
  console.error('Usage: node capture.mjs --app <dir> --base-url <url> --out <artifacts-dir> [--config scenarios.json]');
  process.exit(1);
}

const baseUrl = args.baseUrl || 'http://localhost:8769';
const { viewports, scenarios } = loadScenarios(args.config);
const viewportMap = Object.fromEntries(viewports.map((v) => [v.name, v]));

ensureDir(args.out);
const manifest = [];

const browser = await chromium.launch();
try {
  for (const scenario of scenarios) {
    const vp = viewportMap[scenario.viewport || 'desktop'] || viewports[0];
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const url = `${baseUrl}${scenario.path}`;

    await page.goto(url, { waitUntil: 'networkidle' });

    if (scenario.theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark';
        localStorage.setItem('acme-theme', 'dark');
      });
      await page.reload({ waitUntil: 'networkidle' });
    } else if (scenario.theme === 'light') {
      await page.evaluate(() => {
        document.documentElement.dataset.theme = 'light';
        localStorage.setItem('acme-theme', 'light');
      });
    }

    await applyActions(page, scenario.actions || []);

    const fileName = `${scenario.id}.png`;
    const filePath = path.join(args.out, fileName);
    await page.screenshot({ path: filePath, fullPage: false });
    manifest.push({ id: scenario.id, file: fileName, viewport: vp.name, path: scenario.path });
    await page.close();
    console.log(`  captured ${scenario.id}`);
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(args.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nWrote ${manifest.length} screenshots to ${args.out}\n`);
