'use strict';

// Shared CLI arg parser. Supports --flag value, --flag=value, and boolean
// flags (declared via opts.booleans). Values may begin with "-" only in the
// --flag=value form, which keeps "--out --strict" mistakes loud.
function parseArgs(argv, opts = {}) {
  const booleans = new Set(opts.booleans || []);
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    if (booleans.has(key)) {
      out[key] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`Flag --${key} requires a value (use --${key}=<value> or --${key} <value>)`);
    }
    out[key] = next;
    i++;
  }
  return out;
}

module.exports = { parseArgs };
