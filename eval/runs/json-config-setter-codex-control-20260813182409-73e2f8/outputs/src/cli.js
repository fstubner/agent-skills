'use strict';

const fs = require('node:fs');
const path = require('node:path');

const HELP = `Usage:
  config-set set [--dry-run] <json-file> <dotted-key> <json-value>

Set a nested JSON value in <json-file>.

Arguments:
  <json-file>   Path to the JSON file to update
  <dotted-key>  Dot-separated object path, such as service.retries
  <json-value>  A JSON value, such as 3, true, "fast", or {"x":1}

Options:
  --dry-run     Print the resulting JSON without changing the file
  -h, --help    Show this help
`;

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}

function atomicWrite(file, contents) {
  const absolute = path.resolve(file);
  const directory = path.dirname(absolute);
  const temporary = path.join(
    directory,
    `.${path.basename(absolute)}.${process.pid}.${Date.now()}.tmp`,
  );

  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, contents, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;

    // Keep the existing permissions when replacing an existing file.
    try {
      fs.chmodSync(temporary, fs.statSync(absolute).mode & 0o7777);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    fs.renameSync(temporary, absolute);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(temporary); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function run(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    return;
  }

  const dryRun = argv.includes('--dry-run');
  const args = argv.filter((arg) => arg !== '--dry-run');
  if (args.length !== 4 || args[0] !== 'set') {
    throw new Error('expected: set [--dry-run] <json-file> <dotted-key> <json-value> (use --help for usage)');
  }

  const [, file, dottedKey, rawValue] = args;
  const parts = dottedKey.split('.');
  if (!dottedKey || parts.some((part) => !part)) {
    throw new Error('dotted-key must contain one or more non-empty key names');
  }

  let document;
  try {
    document = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`could not read or parse ${file}: ${error.message}`);
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('the root JSON value must be an object');
  }

  let value;
  try {
    value = JSON.parse(rawValue);
  } catch (error) {
    throw new Error(`json-value is not valid JSON: ${error.message}`);
  }

  let target = document;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (target[part] === undefined) target[part] = {};
    if (target[part] === null || typeof target[part] !== 'object' || Array.isArray(target[part])) {
      throw new Error(`cannot descend through non-object key: ${parts.slice(0, i + 1).join('.')}`);
    }
    target = target[part];
  }
  target[parts[parts.length - 1]] = value;

  const output = `${JSON.stringify(document, null, 2)}\n`;
  if (!dryRun) atomicWrite(file, output);
  process.stdout.write(output);
}

try {
  run(process.argv.slice(2));
} catch (error) {
  fail(error.message);
}

