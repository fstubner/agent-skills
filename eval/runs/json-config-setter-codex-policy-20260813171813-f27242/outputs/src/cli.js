'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');

const HELP = `Usage: config-set set [--dry-run] <json-file> <dotted-key> <json-value>

Set a nested value in a JSON file.

Arguments:
  json-file    Path to the JSON configuration file
  dotted-key   Nested key path, for example server.port
  json-value   A JSON value, for example 8080 or "production"

Options:
  --dry-run    Validate and calculate the change without writing the file
  -h, --help   Show this help message
`;

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  if (argv.includes('-h') || argv.includes('--help')) return { help: true };
  if (argv[0] !== 'set') fail('Expected the subcommand "set".');
  const args = argv.slice(1);
  const dryRun = args.includes('--dry-run');
  const positional = args.filter((arg) => arg !== '--dry-run');
  if (positional.length !== 3) fail('Expected <json-file> <dotted-key> <json-value>.');
  const [file, dottedKey, rawValue] = positional;
  const parts = dottedKey.split('.');
  if (!dottedKey || parts.some((part) => !part)) fail('The dotted-key must contain non-empty segments.');
  let value;
  try { value = JSON.parse(rawValue); } catch { fail('json-value must be valid JSON.'); }
  return { dryRun, file, dottedKey, parts, value };
}

async function updateConfig({ file, dottedKey, parts, value, dryRun }) {
  const absolute = path.resolve(file);
  let original;
  try { original = await fsp.readFile(absolute, 'utf8'); } catch (error) {
    fail(`Unable to read ${file}: ${error.message}`);
  }
  let config;
  try { config = JSON.parse(original); } catch (error) {
    fail(`Invalid JSON in ${file}: ${error.message}`);
  }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    fail('The JSON document root must be an object.');
  }

  let cursor = config;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (cursor[part] === undefined) cursor[part] = {};
    if (cursor[part] === null || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
      fail(`Cannot traverse non-object key "${parts.slice(0, i + 1).join('.')}".`);
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
  const output = JSON.stringify(config, null, 2) + '\n';

  if (!dryRun) {
    const temporary = `${absolute}.${process.pid}.${Date.now()}.tmp`;
    try {
      const handle = await fsp.open(temporary, 'w', 0o600);
      try { await handle.writeFile(output, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      const stat = await fsp.stat(absolute);
      await fsp.chmod(temporary, stat.mode & 0o7777);
      await fsp.rename(temporary, absolute);
    } catch (error) {
      await fsp.rm(temporary, { force: true }).catch(() => {});
      fail(`Unable to write ${file} atomically: ${error.message}`);
    }
  }
  return { file, key: dottedKey, value, dryRun, changed: original !== output };
}

async function main(argv = process.argv.slice(2)) {
  try {
    const parsed = parseArgs(argv);
    if (parsed.help) { process.stderr.write(HELP); return 0; }
    process.stdout.write(`${JSON.stringify(await updateConfig(parsed))}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n${HELP}`);
    return 1;
  }
}

if (require.main === module) main().then((code) => { process.exitCode = code; });

module.exports = { main, parseArgs, updateConfig };
