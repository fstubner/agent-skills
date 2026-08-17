import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: config-set set <json-file> <dotted-key> <json-value> [--dry-run]');
  process.exit(0);
}
const dryRun = args.includes('--dry-run');
const positional = args.filter((arg) => arg !== '--dry-run');
if (positional.length !== 4 || positional[0] !== 'set') {
  console.error('Invalid arguments. Run config-set --help for usage.');
  process.exit(1);
}
const [, filename, dottedKey, rawValue] = positional;
try {
  const document = JSON.parse(fs.readFileSync(filename, 'utf8'));
  let value;
  try { value = JSON.parse(rawValue); } catch { value = rawValue; }
  const parts = dottedKey.split('.');
  let cursor = document;
  for (const part of parts.slice(0, -1)) cursor = cursor[part] ??= {};
  const leaf = parts.at(-1);
  const changed = JSON.stringify(cursor[leaf]) !== JSON.stringify(value);
  cursor[leaf] = value;
  const serialized = JSON.stringify(document, null, 2) + '\n';
  if (!dryRun && changed) {
    const temporary = `${filename}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, serialized);
    fs.renameSync(temporary, filename);
  }
  console.log(JSON.stringify({ changed, path: path.resolve(filename), key: dottedKey, value, dryRun }));
} catch (error) {
  console.error(`Invalid JSON configuration: ${error.message}`);
  process.exit(1);
}
