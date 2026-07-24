'use strict';
// Thin loader over the canonical pattern list in secret-patterns.txt —
// deliberately no hardcoded regex literals here. The .txt file's ERE
// syntax is also valid JS RegExp syntax verbatim (no dialect translation
// needed), so this is a straight parse, not a port. See secret-patterns.txt
// for why the patterns are shaped the way they are.
const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync(path.join(__dirname, 'secret-patterns.txt'), 'utf8');
const SECRET_PATTERNS = raw
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'))
  .map((line) => new RegExp(line));

module.exports = { SECRET_PATTERNS };
