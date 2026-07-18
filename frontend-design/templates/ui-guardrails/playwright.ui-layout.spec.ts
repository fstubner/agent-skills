/**
 * Playwright layout tests — optional @playwright/test integration.
 * Run: npx playwright test ui-guardrails/playwright.ui-layout.spec.ts
 *
 * Requires: npm install -D @playwright/test && npx playwright install chromium
 * Set UI_BASE_URL (default http://127.0.0.1:4173) before running.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertSurfaceLayout } from '../../path-to-skill/scripts/layout-assert.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, 'fragile-surfaces.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const baseURL = process.env.UI_BASE_URL || 'http://127.0.0.1:4173';

const layoutSurfaces = (config.surfaces || []).filter((s) => s.layout);
const viewports = config.viewports || [{ name: 'desktop', width: 1280, height: 800 }];

for (const surface of layoutSurfaces) {
  const vpNames = surface.viewports || viewports.map((v) => v.name);
  for (const vpName of vpNames) {
    const vp = viewports.find((v) => v.name === vpName);
    if (!vp) continue;

    test(`layout ${surface.id} @ ${vpName}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseURL}${surface.path}`, { waitUntil: 'networkidle' });
      await assertSurfaceLayout(page, { ...surface, _viewport: vp }, config);
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeLessThanOrEqual(config.tolerances?.documentScrollY ?? 0);
    });
  }
}
