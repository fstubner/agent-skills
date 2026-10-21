'use strict';
// Locates the suite core. Duplicated verbatim in every skill's scripts/ BY
// DESIGN: it is the one file that cannot itself live in the core, and it
// keeps each skill standalone after install (the installer vendors core/lib,
// core/schemas, and registry.json into scripts/vendor/).
const fs = require('fs');
const path = require('path');

function corePaths() {
  // Vendor first: it was pinned at install time by THIS skill's own
  // install.mjs run, so it's the version this skill was actually shipped
  // with. Preferring an ambient ../../core (a sibling suite checkout, or an
  // older/different install sharing the same skills directory) would run
  // this skill's checker logic against a core it was never tested with —
  // silently, since both candidates satisfy the same existence check.
  const candidates = [
    { core: path.join(__dirname, 'vendor'), registry: path.join(__dirname, 'vendor', 'registry.json') },
    { core: path.resolve(__dirname, '..', '..', 'core'), registry: path.resolve(__dirname, '..', '..', 'registry.json') },
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c.core, 'lib', 'report.cjs')) && fs.existsSync(c.registry)) {
      return { lib: path.join(c.core, 'lib'), schemas: path.join(c.core, 'schemas'), registry: c.registry, suiteRoot: path.resolve(__dirname, '..', '..') };
    }
  }
  throw new Error(
    'agent-skills core not found. Install skills with scripts/install.mjs (which vendors the core), or run from the suite checkout.'
  );
}

module.exports = { corePaths };
