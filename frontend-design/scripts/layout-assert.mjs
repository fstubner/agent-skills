/**
 * Layout invariant checks for viewport-locked app shells.
 * Used by layout-check.mjs, smoke.mjs, and Playwright project tests.
 *
 * Config shape: ui-guardrails/fragile-surfaces.json (see templates/).
 */

const DEFAULT_SIDEBAR = {
  sidebar: '.sidebar',
  mainArea: '.main-area',
  topbar: '.topbar',
  contentWell: '.content-well',
  sidebarNavLast: '.sidebar-nav a:last-child',
};

const DEFAULT_TOPBAR = {
  header: '.app-header',
  scrollRegion: '.app-body',
};

function tol(config, key, fallback) {
  return config?.tolerances?.[key] ?? fallback;
}

/** No document wider than viewport — core responsive invariant. */
export async function assertNoHorizontalOverflow(page, options = {}) {
  const maxPx = tol(options, 'horizontalOverflowPx', 4);
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  if (overflow > maxPx) {
    throw new Error(
      `horizontal overflow ${overflow}px — content wider than viewport (responsive-design.md)`,
    );
  }
}

async function box(page, selector) {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0) return null;
  return loc.boundingBox();
}

/** Sidebar + content-well shell (app-shell.md §8). */
export async function assertSidebarShellLayout(page, options = {}) {
  const sel = { ...DEFAULT_SIDEBAR, ...options.selectors };
  const viewport = options.viewport ?? { width: 1280, height: 800 };
  const strictShell = options.strictShell !== false;

  const scrollY = await page.evaluate(() => window.scrollY);
  const maxScrollY = tol(options, 'documentScrollY', viewport.width >= 1024 ? 0 : 16);
  if (scrollY > maxScrollY) {
    throw new Error(`document scrollY=${scrollY} — expected ≤${maxScrollY} (viewport-locked shell)`);
  }

  if (strictShell && viewport.width >= 1024) {
    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    const expected = options.bodyOverflow ?? 'hidden';
    if (bodyOverflow !== expected) {
      throw new Error(`body overflow is "${bodyOverflow}" — expected "${expected}" on desktop shell`);
    }
  }

  const sidebar = await box(page, sel.sidebar);
  const mainArea = await box(page, sel.mainArea);
  const topbar = await box(page, sel.topbar);
  const contentWell = await box(page, sel.contentWell);

  if (!sidebar || !mainArea || !topbar || !contentWell) {
    throw new Error(`missing shell bounding boxes (selectors: ${JSON.stringify(sel)})`);
  }

  const isDesktopShell = viewport.width >= 1024;
  const colTol = tol(options, 'columnAlign', 4);
  if (isDesktopShell && Math.abs(sidebar.y - mainArea.y) > colTol) {
    throw new Error(
      `sidebar y=${sidebar.y.toFixed(1)} vs main-area y=${mainArea.y.toFixed(1)} — column misaligned (sticky sidebar in flow?)`,
    );
  }

  const mainMaxY = tol(options, 'mainAreaMaxY', 4);
  if (isDesktopShell && mainArea.y > mainMaxY) {
    throw new Error(`main-area y=${mainArea.y.toFixed(1)} — content pushed down (check sidebar positioning)`);
  }

  const gapTol = tol(options, 'contentGapBelowTopbar', 8);
  const gapBelowTopbar = contentWell.y - (topbar.y + topbar.height);
  if (gapBelowTopbar > gapTol) {
    throw new Error(`content ${gapBelowTopbar.toFixed(0)}px below topbar — excessive offset`);
  }

  if (sel.sidebarNavLast && viewport.width >= 1024) {
    const navBox = await box(page, sel.sidebarNavLast);
    if (!navBox || navBox.y + navBox.height > viewport.height) {
      throw new Error('bottom sidebar nav not visible without document scroll');
    }
  }
}

/** Top bar + scrolling body region (app-shell.md §8 top-bar variant). */
export async function assertTopbarShellLayout(page, options = {}) {
  const sel = { ...DEFAULT_TOPBAR, ...options.selectors };
  const viewport = options.viewport ?? { width: 1280, height: 800 };

  const scrollY = await page.evaluate(() => window.scrollY);
  if (scrollY > tol(options, 'documentScrollY', 0)) {
    throw new Error(`document scrollY=${scrollY} — header should be layout-fixed, body region scrolls`);
  }

  if (viewport.width >= 640) {
    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    const expected = options.bodyOverflow ?? 'hidden';
    if (bodyOverflow !== expected) {
      throw new Error(`body overflow "${bodyOverflow}" — expected "${expected}"`);
    }
  }

  const header = await box(page, sel.header);
  const scrollRegion = await box(page, sel.scrollRegion);
  if (!header || !scrollRegion) {
    throw new Error(`missing topbar shell boxes (selectors: ${JSON.stringify(sel)})`);
  }

  const gapTol = tol(options, 'scrollRegionBelowHeader', 4);
  const gap = scrollRegion.y - (header.y + header.height);
  if (gap > gapTol) {
    throw new Error(`scroll region ${gap.toFixed(0)}px below header — excessive offset`);
  }

  if (header.y > tol(options, 'headerMaxY', 2)) {
    throw new Error(`header y=${header.y.toFixed(1)} — chrome pushed down`);
  }
}

export async function assertSurfaceLayout(page, surface, config) {
  const shell = config.shell || 'sidebar';
  const viewport = surface._viewport ?? { width: 1280, height: 800 };
  const layoutOpts = {
    selectors: config.selectors,
    viewport,
    tolerances: config.tolerances,
    bodyOverflow: surface.bodyOverflow ?? config.bodyOverflow,
    strictShell: surface.strictShell ?? (viewport.width >= 1024 && config.strictShell !== false),
  };

  if (shell === 'topbar') {
    await assertTopbarShellLayout(page, layoutOpts);
  } else {
    await assertSidebarShellLayout(page, layoutOpts);
  }
}

export async function runLayoutSuite(browser, baseUrl, config) {
  const viewports = config.viewports || [{ name: 'desktop', width: 1280, height: 800 }];
  const surfaces = (config.surfaces || []).filter((s) => s.layout);
  const failed = [];
  const passed = [];

  for (const surface of surfaces) {
    const vpNames = surface.viewports || viewports.map((v) => v.name);
    for (const vpName of vpNames) {
      const vp = viewports.find((v) => v.name === vpName);
      if (!vp) {
        failed.push({ id: `${surface.id}/${vpName}`, reason: `unknown viewport: ${vpName}` });
        continue;
      }

      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      try {
        const url = `${baseUrl.replace(/\/$/, '')}${surface.path}`;
        await page.goto(url, { waitUntil: 'networkidle' });

        if (surface.actions?.length) {
          for (const action of surface.actions) {
            if (action.type === 'wait') await page.waitForTimeout(action.ms);
            else if (action.type === 'click') await page.click(action.selector);
            else if (action.type === 'fill') await page.fill(action.selector, action.value);
          }
        }

        await assertSurfaceLayout(page, { ...surface, _viewport: vp }, config);
        if (surface.responsive !== false) {
          await assertNoHorizontalOverflow(page, { tolerances: config.tolerances });
        }
        passed.push(`${surface.id}/${vpName}`);
        console.log(`  PASS layout ${surface.id}/${vpName}`);
      } catch (e) {
        failed.push({ id: `${surface.id}/${vpName}`, reason: e.message });
        console.log(`  FAIL layout ${surface.id}/${vpName}: ${e.message}`);
      } finally {
        await page.close();
      }
    }
  }

  return { passed, failed };
}

/** @deprecated use assertSidebarShellLayout */
export async function assertViewportShellLayout(page) {
  await assertSidebarShellLayout(page, {});
}
