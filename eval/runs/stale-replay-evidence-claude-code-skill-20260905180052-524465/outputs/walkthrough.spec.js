// GENERATED from ux-walkthrough.md — do not edit.
// Regenerate: node <product-acceptance>/scripts/gen-walkthrough-spec.mjs --root .
//
// Run it, then point acceptance at the log:
//   npx playwright test walkthrough.spec.js --reporter=json > .agent-evidence/walkthrough-run.json
//
// The log records the hash below. Acceptance regenerates this spec and
// compares, so a log from before the walkthrough changed reads as stale
// rather than as evidence.
import { test, expect } from '@playwright/test';

test("walkthrough step 1", async ({ page }) => {
  await page.goto("/notes");
  await expect(page.getByText("No notes for this shift yet.")).toBeVisible();
});
// specSha256: 7b39e3b36ba11aa58162c131dcb45dbdcd435728d30f8217b7e06f0bbbf890f2
