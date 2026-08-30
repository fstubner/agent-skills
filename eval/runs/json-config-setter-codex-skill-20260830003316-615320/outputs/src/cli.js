#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const HELP = `Usage:
  config-set set <json-file> <dotted-key> <json-value> [--dry-run]

Update a nested value in a JSON file.

Arguments:
  <json-file>    JSON file to update
  <dotted-key>   Dot-separated object path, for example service.retries
  <json-value>   Value parsed as JSON (use '"text"' for a string)

Options:
  --dry-run      Show the result without writing the file
  -h, --help     Show this help
  -v, --version  Show the version

The result is emitted as JSON on stdout. Errors and diagnostics are emitted on stderr.
`;

const VERSION = '1.0.0';

function fail(message, code = 1) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = code;
}

function atomicWrite(file, contents, mode) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, { encoding: 'utf8', mode });
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch (_) { /* best effort cleanup */ }
    throw error;
  }
}

function main(args) {
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    process.stdout.write(HELP);
    return;
  }
  if (args.length === 1 && args[0] === '--version') {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  const dryRun = args.includes('--dry-run');
  const positional = args.filter((arg) => arg !== '--dry-run');
  if (positional.length !== 4 || positional[0] !== 'set') {
    throw new Error('expected: config-set set <json-file> <dotted-key> <json-value> [--dry-run]; use --help for details');
  }

  const [, fileArg, dottedKey, rawValue] = positional;
  if (!dottedKey || dottedKey.startsWith('.') || dottedKey.endsWith('.') || dottedKey.includes('..')) {
    throw new Error('dotted-key must contain non-empty dot-separated property names');
  }
  let value;
  try { value = JSON.parse(rawValue); } catch (error) {
    throw new Error(`json-value is not valid JSON: ${error.message}`);
  }

  const file = path.resolve(fileArg);
  let original;
  try { original = fs.readFileSync(file, 'utf8'); } catch (error) {
    throw new Error(`cannot read ${file}: ${error.message}`);
  }
  let document;
  try { document = JSON.parse(original); } catch (error) {
    throw new Error(`cannot parse ${file} as JSON: ${error.message}`);
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('JSON root must be an object');
  }

  const keys = dottedKey.split('.');
  let cursor = document;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (cursor[key] === undefined) cursor[key] = {};
    else if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
      throw new Error(`cannot set ${dottedKey}: ${key} is not an object`);
    }
    cursor = cursor[key];
  }
  const leaf = keys[keys.length - 1];
  const changed = !Object.is(cursor[leaf], value);
  cursor[leaf] = value;
  const output = JSON.stringify(document, null, 2) + '\n';
  if (changed && !dryRun) atomicWrite(file, output, fs.statSync(file).mode & 0o777);
  process.stdout.write(`${JSON.stringify({ file, key: dottedKey, value, changed, dryRun })}\n`);
}

try { main(process.argv.slice(2)); } catch (error) { fail(error.message); }
