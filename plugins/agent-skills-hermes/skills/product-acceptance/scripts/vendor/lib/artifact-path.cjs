'use strict';

// Where a project keeps one of the registry's document artifacts. Producers
// write PRODUCT.md, ARCHITECTURE.md, design-direction.md and the rest at the
// project root, but a project may keep them under docs/ or docs/design/
// instead of cluttering its root. Every consumer resolves through here so the
// search order is stated once.
const fs = require('fs');
const path = require('path');

// First hit wins, so a root copy shadows a docs/ one.
const ARTIFACT_DIRS = ['', 'docs', 'docs/design'];

// Returns { abs, rel } for the first existing `<root>/<dir>/<file>`, or null.
// `rel` is root-relative with forward slashes, for messages.
function resolveArtifactFile(root, file) {
  for (const dir of ARTIFACT_DIRS) {
    const rel = dir ? `${dir}/${file}` : file;
    const abs = path.join(root, ...rel.split('/'));
    if (fs.existsSync(abs)) return { abs, rel };
  }
  return null;
}

module.exports = { ARTIFACT_DIRS, resolveArtifactFile };
