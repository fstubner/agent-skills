#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const VERSION = '1.0.0';

function usage() {
  return `Usage: config-set set <json-file> <dotted-key> <json-value> [--dry-run]

Update a nested value in a JSON file.

Arguments:
  <json-file>    Path to the JSON file to update
  <dotted-key>   Nested property path, for example service.retries
  <json-value>   A JSON value, for example 3, true, null, or \"fast\"

Options:
  --dry-run      Show the result without writing the file
  --help, -h     Show this help
  --version, -v  Show the version

Examples:
  config-set set config.json service.retries 3
  config-set set config.json service.name '"api"' --dry-run
`;
}

function fail(message, code = 1) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = code;
}

function atomicWrite(file, contents, mode) {
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temporary, contents, { encoding: 'utf8', mode });
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch (_) {}
    throw error;
  }
}

function main(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(usage());
    return;
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  const dryRun = argv.includes('--dry-run');
  const args = argv.filter(arg => arg !== '--dry-run');
  if (args.length !== 4 || args[0] !== 'set') {
    throw new Error('expected: config-set set <json-file> <dotted-key> <json-value> [--dry-run] (use --help for details)');
  }

  const [, file, dottedKey, rawValue] = args;
  const parts = dottedKey.split('.');
  if (!dottedKey || parts.some(part => !part || part === '__proto__' || part === 'prototype' || part === 'constructor')) {
    throw new Error('dotted-key must contain non-empty, safe property names');
  }

  let original;
  try { original = fs.readFileSync(file, 'utf8'); } catch (error) { throw new Error(`cannot read ${file}: ${error.message}`); }
  let document;
  try { document = JSON.parse(original); } catch (error) { throw new Error(`${file} is not valid JSON: ${error.message}`); }
  let value;
  try { value = JSON.parse(rawValue); } catch (error) { throw new Error('json-value is not valid JSON'); }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) throw new Error('the JSON document must contain an object at its root');

  let target = document;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (target[part] === undefined) target[part] = {};
    else if (target[part] === null || typeof target[part] !== 'object' || Array.isArray(target[part])) throw new Error(`cannot traverse ${parts.slice(0, i + 1).join('.')}: expected an object`);
    target = target[part];
  }
  const leaf = parts[parts.length - 1];
  const changed = !Object.prototype.hasOwnProperty.call(target, leaf) || JSON.stringify(target[leaf]) !== JSON.stringify(value);
  target[leaf] = value;
  const output = JSON.stringify(document, null, 2) + '\n';
  if (changed && !dryRun) atomicWrite(file, output, fs.statSync(file).mode & 0o777);
  process.stdout.write(JSON.stringify({ file, key: dottedKey, value, changed, dryRun }) + '\n');
}

try { main(process.argv.slice(2)); } catch (error) { fail(error.message); }
