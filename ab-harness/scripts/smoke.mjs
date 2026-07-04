#!/usr/bin/env node
/**
 * Interaction + layout smoke tests.
 *
 * Usage:
 *   node smoke.mjs --base-url http://localhost:PORT
 *   node smoke.mjs --base-url http://localhost:PORT --config ui-guardrails/fragile-surfaces.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { applyActions, loadScenarios, parseArgs } from './lib.mjs';
import {
  assertSidebarShellLayout,
  assertTopbarShellLayout,
  assertNoHorizontalOverflow,
} from '../../scripts/layout-assert.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.baseUrl) {
  console.error('Usage: node smoke.mjs --base-url http://localhost:PORT [--config fragile-surfaces.json]');
  process.exit(1);
}

function loadSmokeTests() {
  if (args.config && fs.existsSync(args.config)) {
    const config = JSON.parse(fs.readFileSync(args.config, 'utf8'));
    return { smoke: config.smoke || [], config };
  }
  const { smoke } = loadScenarios();
  return { smoke, config: null };
}

const { smoke, config } = loadSmokeTests();
const failed = [];

const browser = await chromium.launch();
try {
  for (const test of smoke) {
    const vp = test.viewport ?? { width: 1280, height: 800 };
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    try {
      const url = `${args.baseUrl.replace(/\/$/, '')}${test.path}`;
      await page.goto(url, { waitUntil: 'networkidle' });

      if (test.action) {
        await applyActions(page, [test.action]);
        if (test.action.type === 'click' && test.action.selector === '#theme-toggle') {
          await page.waitForTimeout(100);
        }
        if (test.action.type === 'click' && test.action.selector === '#save-profile') {
          await page.waitForTimeout(900);
        }
      }

      if (test.expect) {
        const visible = await page.locator(test.expect).isVisible();
        if (!visible) {
          failed.push({ id: test.id, reason: `Expected visible: ${test.expect}` });
          console.log(`  FAIL ${test.id}: ${test.expect} not visible`);
          continue;
        }
      }

      if (test.expectVisible) {
        const visible = await page.locator(test.expectVisible).first().isVisible();
        if (!visible) {
          failed.push({ id: test.id, reason: `Expected visible: ${test.expectVisible}` });
          console.log(`  FAIL ${test.id}: ${test.expectVisible} not visible`);
          continue;
        }
      }

      if (test.expectAttr) {
        const val = await page.locator(test.expectAttr.selector).getAttribute(test.expectAttr.attr);
        if (val !== test.expectAttr.value) {
          failed.push({ id: test.id, reason: `Expected ${test.expectAttr.attr}=${test.expectAttr.value}, got ${val}` });
          console.log(`  FAIL ${test.id}: attr ${test.expectAttr.attr}=${val}`);
          continue;
        }
      }

      if (test.layout) {
        try {
          if (config?.shell === 'topbar') {
            await assertTopbarShellLayout(page, { selectors: config.selectors, viewport: vp });
          } else {
            await assertSidebarShellLayout(page, {
              selectors: config?.selectors,
              viewport: vp,
              strictShell: vp.width >= 1024,
            });
          }
        } catch (e) {
          failed.push({ id: test.id, reason: e.message });
          console.log(`  FAIL ${test.id}: ${e.message}`);
          continue;
        }
      }

      if (test.responsive) {
        try {
          await assertNoHorizontalOverflow(page, { tolerances: config?.tolerances });
        } catch (e) {
          failed.push({ id: test.id, reason: e.message });
          console.log(`  FAIL ${test.id}: ${e.message}`);
          continue;
        }
      }

      console.log(`  PASS ${test.id}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log(failed.length ? `\nsmoke: ${failed.length} failed\n` : '\nsmoke: all passed\n');
process.exit(failed.length ? 1 : 0);
